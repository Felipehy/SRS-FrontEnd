import { api } from "../lib/api";
import type { CategoryKey, ReservationStatus } from "../../app/types/calendar";

export const USER_RESERVATIONS_ENDPOINT = "/user/reservations";
export const USER_RESERVATIONS_PAGE_SIZE = 10;

const KNOWN_STATUSES: ReservationStatus[] = [
  "ENVIADA_PARA_ANALISE", "APROVADA", "REPROVADA", "FINALIZADA", "CANCELADA",
];

export interface UserReservation {
  id: number;
  reservationType: string;
  category: CategoryKey | null;
  status: ReservationStatus | null;
  reservationDate: string;
  startTime: string;
  endTime: string;
  userNameRequester: string;
  idUser: number | null;
}

export interface UserReservationsPage {
  reservations: UserReservation[];
  totalReservations: number;
  totalPages: number;
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function toCategory(v: unknown): CategoryKey | null {
  const s = str(v).toUpperCase().replace(/[^A-Z]/g, "");
  if (s === "MEETINGROOM") return "MEETING_ROOM";
  if (s === "AUDITORIUM") return "AUDITORIUM";
  if (s === "FLEETVEHICLE") return "FLEET_VEHICLE";
  return null;
}

function toStatus(v: unknown): ReservationStatus | null {
  const s = str(v).toUpperCase();
  if ((KNOWN_STATUSES as string[]).includes(s)) return s as ReservationStatus;
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function normalizeReservation(raw: any): UserReservation {
  return {
    id: Number(raw?.id),
    reservationType: str(raw?.reservationType),
    category: toCategory(raw?.reservationType),
    status: toStatus(raw?.status),
    reservationDate: str(raw?.reservationDate),
    startTime: str(raw?.startTime),
    endTime: str(raw?.endTime),
    userNameRequester: str(raw?.userNameRequester),
    idUser: toNumber(raw?.idUser),
  };
}

export async function fetchUserReservations(page: number, date: string, types: CategoryKey[]): Promise<UserReservationsPage> {
  const params: Record<string, string | number | string[]> = { pagination: page };
  if (date) params.date = date;
  if (types.length > 0) params.type = types;

  const { data } = await api.get(USER_RESERVATIONS_ENDPOINT, {
    params,
    paramsSerializer: { indexes: null },
  });

  let lista: any[] = [];
  if (Array.isArray(data?.reservations)) lista = data.reservations;

  let totalReservations = toNumber(data?.numReservations);
  if (totalReservations === null) totalReservations = lista.length;

  const totalPages = Math.ceil(totalReservations / USER_RESERVATIONS_PAGE_SIZE);

  return {
    reservations: lista.map(normalizeReservation),
    totalReservations,
    totalPages,
  };
}
