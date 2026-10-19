import { createContext, useContext, useState } from "react";
import type { CategoryKey } from "../types/calendar";
import { useAuth, type UserColors } from "./AuthContext";
import { saveUserColors } from "../../api/service/userSettingsService";

export type CategoryColors = Record<CategoryKey, string>;

const STORAGE_KEY = "reservas:categoryColors:v2";

const DEFAULT_COLORS: CategoryColors = {
  MEETING_ROOM:  "#0284c7",
  AUDITORIUM:    "#5b4fcf",
  FLEET_VEHICLE: "#f59e0b",
};

function loadStored(): Partial<CategoryColors> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Partial<CategoryColors>;
  } catch {
  }
  return {};
}

function resolveColors(fromBackend: UserColors | undefined): CategoryColors {
  return { ...DEFAULT_COLORS, ...loadStored(), ...(fromBackend ?? {}) };
}

interface CategoryColorsContextValue {
  colors: CategoryColors;
  setColor: (category: CategoryKey, color: string) => void;
  resetColors: () => void;
  saveColors: () => Promise<void>;
  hasChanges: boolean;
  saving: boolean;
}

const CategoryColorsContext = createContext<CategoryColorsContextValue | null>(null);

export function CategoryColorsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [initialColors] = useState<CategoryColors>(() => resolveColors(user?.colors));
  const [colors, setColors] = useState<CategoryColors>(initialColors);
  const [savedColors, setSavedColors] = useState<CategoryColors>(initialColors);
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(colors) !== JSON.stringify(savedColors);

  const setColor = (category: CategoryKey, color: string) => {
    setColors(prev => ({ ...prev, [category]: color }));
  };

  const resetColors = () => {
    setColors(DEFAULT_COLORS);
  };

  const saveColors = async () => {
    setSaving(true);
    try {
      await saveUserColors(colors);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
      } catch {
      }
      setSavedColors(colors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CategoryColorsContext.Provider value={{ colors, setColor, resetColors, saveColors, hasChanges, saving }}>
      {children}
    </CategoryColorsContext.Provider>
  );
}

export function useCategoryColors() {
  const ctx = useContext(CategoryColorsContext);
  if (!ctx) throw new Error("useCategoryColors must be used inside CategoryColorsProvider");
  return ctx;
}

export { DEFAULT_COLORS };
