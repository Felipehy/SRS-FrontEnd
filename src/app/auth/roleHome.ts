import type { Role } from "../context/AuthContext";

export const HOME_BY_ROLE: Record<Role, string> = {
  geral:  "/",
  frotas: "/gestao-frotas",
  da:     "/da",
  admin:  "/",
};

export function homeFor(role: Role | undefined): string {
  if (role && HOME_BY_ROLE[role]) return HOME_BY_ROLE[role];
  return "/";
}
