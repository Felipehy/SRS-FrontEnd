import type { AuthUser, UserGroup } from "../context/AuthContext";
import { DEFAULT_ROLE, ROLE_LABELS, roleRank, type Role } from "./roles";
import { api } from "../../api/lib/api";
import { groupColorOf, type AppGroup } from "../../api/service/groupService";
import {
  USER_ENDPOINT, parseColors, parseNavLayout, parseUserGroups,
  type UserColors, type NavLayout,
} from "../../api/service/userSettingsService";

const USERINFO_URL = "/auth/userinfo";

const ROLE_BY_GROUP: Record<string, Role> = {
  geral: "geral",
  usuariogeral: "geral",
  usuariosgeraisespeciais: "geral",
  frotas: "frotas",
  frota: "frotas",
  divisaofrotas: "frotas",
  da: "da",
  divisaoadministrativa: "da",
  admin: "admin",
  administrador: "admin",
};

export const FALLBACK_ROLES: Role[] = [DEFAULT_ROLE];

const NAME_PLACEHOLDER = "Usuário";

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export const GROUP_PREFIX = "siurb";

function singular(token: string): string {
  if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function lookupRole(token: string): Role | undefined {
  if (ROLE_BY_GROUP[token]) return ROLE_BY_GROUP[token];
  return ROLE_BY_GROUP[singular(token)];
}

export function roleFromGroup(group: string): Role | undefined {
  const n = normalize(group);
  if (!n) return undefined;

  const direct = lookupRole(n);
  if (direct) return direct;

  if (n.startsWith(GROUP_PREFIX)) {
    const rest = lookupRole(n.slice(GROUP_PREFIX.length));
    if (rest) return rest;
  }
  return undefined;
}

export function decodeJwtPayload(token: string): Record<string, any> | null {
  const parts = token?.split(".");
  if (!parts || parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) {
      b64 += "=";
    }
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  let initials = parts[0]?.[0] ?? "";
  if (parts.length > 1) {
    initials += parts[parts.length - 1][0];
  }
  initials = initials.toUpperCase();
  if (!initials) return "?";
  return initials;
}

type Identity = { id: string; email: string };

function buildIdentity(oidcData: string, accessToken: string): Identity | null {
  const d = decodeJwtPayload(oidcData) ?? {};
  const a = decodeJwtPayload(accessToken) ?? {};
  const claims = { ...a, ...d };

  const sub = claims.sub ?? claims.username ?? claims["cognito:username"];
  if (!sub) return null;

  return { id: String(sub), email: String(claims.email ?? "") };
}

export const FALLBACK_GROUP: UserGroup = {
  groupName: ROLE_LABELS[DEFAULT_ROLE],
  groupCognito: "",
  color: groupColorOf({}),
  role: DEFAULT_ROLE,
  mapped: false,
};

export function buildGroups(groups: AppGroup[]): UserGroup[] {
  const out: UserGroup[] = [];
  for (const group of groups) {
    const role = roleFromGroup(group.groupCognito);
    out.push({
      groupName: group.groupName,
      groupCognito: group.groupCognito,
      color: groupColorOf(group),
      role: role ?? DEFAULT_ROLE,
      mapped: !!role,
    });
  }

  out.sort((a, b) => {
    const byRank = roleRank(a.role) - roleRank(b.role);
    if (byRank !== 0) return byRank;
    return a.groupName.localeCompare(b.groupName, "pt-BR");
  });

  if (out.length === 0) return [FALLBACK_GROUP];
  return out;
}

async function fetchUserinfo(): Promise<{ data: string; accessToken: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      signal: ctrl.signal,
    });
    if (!res.ok) return null;

    const body = (await res.json().catch(() => null)) as { data?: string; accessToken?: string } | null;
    if (!body) return null;
    if (!body.data && !body.accessToken) return null;

    return { data: body.data ?? "", accessToken: body.accessToken ?? "" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function numericId(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

type Me = { userId?: number; idDepartment?: number; name: string; colors?: UserColors; navLayout?: NavLayout; groups: AppGroup[]; rawGroups: unknown; isFirstLogin: boolean };

async function fetchMe(): Promise<Me> {
  try {
    const { data } = await api.get<{
      id?: unknown;
      idDepartment?: unknown;
      givenName?: string;
      familyName?: string;
      colors?: Record<string, string>;
      isHorizontalNavbar?: boolean;
      groups?: unknown;
      isFirstLogin?: unknown;
    }>(USER_ENDPOINT);

    const userId = numericId(data?.id);
    if (userId === undefined) {
      console.warn(`[auth] GET /api${USER_ENDPOINT} não devolveu o id numérico do usuário — as reservas serão enviadas sem userId.`);
    }

    const idDepartment = numericId(data?.idDepartment);
    if (idDepartment === undefined) {
      console.warn(`[auth] GET /api${USER_ENDPOINT} veio sem idDepartment — o usuário não tem departamento vinculado e os formulários vão ficar sem a divisão.`);
    }

    let givenName = "";
    let familyName = "";
    if (typeof data?.givenName === "string") givenName = data.givenName.trim();
    if (typeof data?.familyName === "string") familyName = data.familyName.trim();

    let name = givenName;
    if (familyName) {
      name = name ? `${name} ${familyName}` : familyName;
    }

    const navLayout = parseNavLayout(data?.isHorizontalNavbar);
    const rawGroups = data?.groups;
    const groups = parseUserGroups(rawGroups);

    if (rawGroups && groups.length === 0) {
      console.warn("[auth] GET /api/user devolveu 'groups', mas nenhum grupo pôde ser lido:", rawGroups);
    }

    const isFirstLogin = data?.isFirstLogin === true;

    return { userId, idDepartment, name, colors: parseColors(data?.colors), navLayout, groups, rawGroups, isFirstLogin };
  } catch (err: any) {
    console.error(
      `[auth] GET /api${USER_ENDPOINT} falhou (${err?.status ?? "sem status"}) —`,
      "sem nome, sem grupos e sem preferências. O usuário vai entrar com o acesso padrão.",
      err?.detail ?? err?.message ?? err,
    );
    return { name: "", groups: [], rawGroups: undefined, isFirstLogin: false };
  }
}

export async function fetchDevIds(): Promise<{ userId?: number; idDepartment?: number; isFirstLogin: boolean }> {
  const me = await fetchMe();
  return { userId: me.userId, idDepartment: me.idDepartment, isFirstLogin: me.isFirstLogin };
}

export async function fetchAlbUser(): Promise<AuthUser | null> {
  const info = await fetchUserinfo();
  if (!info) return null;

  const identity = buildIdentity(info.data, info.accessToken);
  if (!identity) return null;

  const me = await fetchMe();
  const groups = buildGroups(me.groups);

  if (groups.length === 1 && !groups[0].groupCognito) {
    console.warn(
      "[auth] GET /api/user não devolveu nenhum grupo — usuário entra com o acesso padrão.",
      "\n  atributo groups recebido:", me.rawGroups,
    );
  }

  const roles: Role[] = [];
  for (const group of groups) {
    if (!roles.includes(group.role)) roles.push(group.role);
  }

  let name = me.name;
  if (!name) {
    console.warn(`[auth] GET /api/user não devolveu nome — exibindo "${NAME_PLACEHOLDER}".`);
    name = NAME_PLACEHOLDER;
  }

  return {
    id: identity.id,
    userId: me.userId,
    idDepartment: me.idDepartment,
    name,
    email: identity.email,
    initials: initialsFrom(name),
    groups,
    activeGroup: groups[0],
    activeRole: groups[0].role,
    roles,
    colors: me.colors,
    navLayout: me.navLayout,
    nameResolved: !!me.name,
    isFirstLogin: me.isFirstLogin,
  };
}
