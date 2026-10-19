import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { fetchAlbUser, fetchDevIds } from "../auth/albAuth";
import { profileImageUrl } from "../../api/service/efsService";
import { ALL_ROLES, ROLE_LABELS, type Role } from "../auth/roles";
import type { UserColors, NavLayout } from "../../api/service/userSettingsService";

export { ALL_ROLES, ROLE_LABELS };
export type { Role, UserColors, NavLayout };

export interface UserGroup {
  groupName: string;
  groupCognito: string;
  color: string;
  role: Role;
  mapped: boolean;
}

export interface AuthUser {
  id: string;
  userId?: number;
  idDepartment?: number;
  name: string;
  email: string;
  initials: string;
  groups: UserGroup[];
  activeGroup: UserGroup;
  roles: Role[];
  activeRole: Role;
  colors?: UserColors;
  navLayout?: NavLayout;
  pictureUrl?: string;
  nameResolved: boolean;
  isFirstLogin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: Role) => boolean;
  switchGroup: (groupCognito: string) => void;
  refreshPicture: () => void;
  markTutorialDone: () => void;
  logout: () => void;
}

const DEV_GROUPS: UserGroup[] = [
  { groupName: "Usuário Geral", groupCognito: "siurb-geral", color: "#475569", role: "geral", mapped: true },
  { groupName: "Usuário Geral", groupCognito: "siurb-usuarios-gerais-especiais", color: "#0891b2", role: "geral", mapped: true },
  { groupName: "Divisão de Frotas", groupCognito: "siurb-frotas", color: "#ca8a04", role: "frotas", mapped: true },
  { groupName: "Divisão Administrativa", groupCognito: "siurb-da", color: "#2563eb", role: "da", mapped: true },
  { groupName: "Administradores", groupCognito: "siurb-administrador", color: "#5b4fcf", role: "admin", mapped: true },
];

const DEV_USER: AuthUser = {
  id: "dev",
  name: "Teste (dev)",
  email: "teste@example.com",
  initials: "T",
  groups: DEV_GROUPS,
  activeGroup: DEV_GROUPS[0],
  roles: ["geral", "frotas", "da", "admin"],
  activeRole: "geral",
  nameResolved: true,
  isFirstLogin: false,
};

async function devUser(): Promise<AuthUser> {
  const { userId, idDepartment, isFirstLogin } = await fetchDevIds();
  return { ...DEV_USER, userId, idDepartment, isFirstLogin };
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PICTURE_VERSION_KEY = "reservas:pictureVersion";
const ACTIVE_GROUP_KEY = "reservas:activeGroup";

function storedActiveGroup(userId: string): string {
  try {
    const raw = localStorage.getItem(ACTIVE_GROUP_KEY);
    if (!raw) return "";
    const map = JSON.parse(raw) as Record<string, string>;
    return map[userId] ?? "";
  } catch {
  }
  return "";
}

function storeActiveGroup(userId: string, groupCognito: string) {
  try {
    let map: Record<string, string> = {};
    const raw = localStorage.getItem(ACTIVE_GROUP_KEY);
    if (raw) map = JSON.parse(raw) as Record<string, string>;
    map[userId] = groupCognito;
    localStorage.setItem(ACTIVE_GROUP_KEY, JSON.stringify(map));
  } catch {
  }
}

function withStoredGroup(user: AuthUser): AuthUser {
  const saved = storedActiveGroup(user.id);
  if (!saved) return user;
  const found = user.groups.find(g => g.groupCognito === saved);
  if (!found) return user;
  return { ...user, activeGroup: found, activeRole: found.role };
}

function pictureVersions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PICTURE_VERSION_KEY);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
  }
  return {};
}

function pictureUrlFor(userId: string, stamp?: number): string {
  const version = stamp ?? pictureVersions()[userId] ?? 0;
  return profileImageUrl(`${userId}.${version}`);
}

function bumpPictureVersion(userId: string): number {
  const stamp = Date.now();
  try {
    localStorage.setItem(PICTURE_VERSION_KEY, JSON.stringify({ ...pictureVersions(), [userId]: stamp }));
  } catch {
  }
  return stamp;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    function ready(u: AuthUser): AuthUser {
      return withStoredGroup({ ...u, pictureUrl: pictureUrlFor(u.id) });
    }

    fetchAlbUser()
      .then(async u => {
        if (!alive) return;
        if (u) {
          setUser(ready(u));
          return;
        }
        if (import.meta.env.DEV) {
          console.warn(
            "[auth] Sem sessão do ALB — usando o USUÁRIO FAKE de desenvolvimento.",
            "\n  Os perfis listados são os DEV_GROUPS hardcoded, NÃO os seus grupos reais do Cognito.",
            "\n  Em dev o Vite só faz proxy de /api; /auth/userinfo é servido pelo nginx e não existe aqui.",
            "\n  O userId e o departamento das reservas são os reais, lidos do GET /api/user.",
          );
          const dev = await devUser();
          if (!alive) return;
          setUser(ready(dev));
          return;
        }
        console.warn("[auth] Sem sessão do ALB — o acesso deveria ter sido autenticado antes.");
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const hasRole = useCallback(
    (role: Role) => user?.roles.includes(role) ?? false,
    [user],
  );

  const switchGroup = useCallback((groupCognito: string) => {
    setUser(u => {
      if (!u) return u;
      const found = u.groups.find(g => g.groupCognito === groupCognito);
      if (!found) return u;
      storeActiveGroup(u.id, groupCognito);
      return { ...u, activeGroup: found, activeRole: found.role };
    });
  }, []);

  const refreshPicture = useCallback(() => {
    if (!user) return;
    const stamp = bumpPictureVersion(user.id);
    setUser(u => u ? { ...u, pictureUrl: pictureUrlFor(u.id, stamp) } : u);
  }, [user]);

  const markTutorialDone = useCallback(() => {
    setUser(u => u ? { ...u, isFirstLogin: false } : u);
  }, []);

  const logout = useCallback(() => {
    const url = import.meta.env.VITE_COGNITO_LOGOUT_URL;
    if (url) {
      window.location.href = url;
    } else {
      window.location.reload();
    }
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--muted-foreground, #888)" }}>
        Carregando…
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, hasRole, switchGroup, refreshPicture, markTutorialDone, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
