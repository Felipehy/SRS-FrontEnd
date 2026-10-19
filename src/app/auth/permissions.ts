import type { AuthUser } from "../context/AuthContext";
import type { CalEvent } from "../types/calendar";

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function isRequester(user: AuthUser | null, event: CalEvent): boolean {
  if (!user) return false;
  if (!user.nameResolved) return false;

  const solicitante = normalizeName(event.responsavel ?? "");
  if (!solicitante) return false;

  return normalizeName(user.name) === solicitante;
}

export function canCancelReservation(user: AuthUser | null, event: CalEvent): boolean {
  if (!user) return false;
  if (event.status === "CANCELADA") return false;
  if (user.roles.includes("admin")) return true;
  if (user.roles.includes("da")) return true;
  return isRequester(user, event);
}

export const SPECIAL_GROUP = "siurb-usuarios-gerais-especiais";

export function ignoresReservationRules(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.activeRole === "admin";
}

export function canBookOverApproved(user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.activeRole === "admin") return true;
  return user.activeGroup.groupCognito.trim().toLowerCase() === SPECIAL_GROUP;
}
