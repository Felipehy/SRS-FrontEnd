export type Role = "geral" | "frotas" | "da" | "admin";

export const ALL_ROLES: Role[] = ["geral", "frotas", "da", "admin"];

export const ROLE_PRIORITY: Role[] = ["geral", "frotas", "da", "admin"];

export const DEFAULT_ROLE: Role = "geral";

export const ROLE_LABELS: Record<Role, string> = {
  geral:  "Usuário Geral",
  frotas: "Frotas",
  da:     "DA",
  admin:  "Administrador",
};

export function roleRank(role: Role): number {
  const i = ROLE_PRIORITY.indexOf(role);
  if (i < 0) return ROLE_PRIORITY.length;
  return i;
}
