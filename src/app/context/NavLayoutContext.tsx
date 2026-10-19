import { createContext, useContext, useState } from "react";
import { useAuth, type NavLayout } from "./AuthContext";
import { saveUserNavLayout } from "../../api/service/userSettingsService";

export type { NavLayout };

const STORAGE_KEY = "reservas:nav-layout";

function loadStored(): NavLayout | undefined {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "navbar" || raw === "sidebar") return raw;
  } catch {
  }
  return undefined;
}

function resolveNavLayout(fromBackend: NavLayout | undefined): NavLayout {
  return fromBackend ?? loadStored() ?? "navbar";
}

interface NavLayoutContextValue {
  navLayout: NavLayout;
  setNavLayout: (layout: NavLayout) => void;
  saveLayout: () => Promise<void>;
  hasChanges: boolean;
  saving: boolean;
}

const NavLayoutContext = createContext<NavLayoutContextValue | null>(null);

export function NavLayoutProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [initialLayout] = useState<NavLayout>(() => resolveNavLayout(user?.navLayout));
  const [navLayout, setNavLayout] = useState<NavLayout>(initialLayout);
  const [savedLayout, setSavedLayout] = useState<NavLayout>(initialLayout);
  const [saving, setSaving] = useState(false);

  const hasChanges = navLayout !== savedLayout;

  const saveLayout = async () => {
    setSaving(true);
    try {
      await saveUserNavLayout(navLayout);
      try {
        localStorage.setItem(STORAGE_KEY, navLayout);
      } catch {
      }
      setSavedLayout(navLayout);
    } finally {
      setSaving(false);
    }
  };

  return (
    <NavLayoutContext.Provider value={{ navLayout, setNavLayout, saveLayout, hasChanges, saving }}>
      {children}
    </NavLayoutContext.Provider>
  );
}

export function useNavLayout() {
  const ctx = useContext(NavLayoutContext);
  if (!ctx) throw new Error("useNavLayout must be used inside NavLayoutProvider");
  return ctx;
}
