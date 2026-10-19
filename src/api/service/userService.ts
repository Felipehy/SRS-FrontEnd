import { api } from "../lib/api";

export const USER_ENDPOINT = "/admin/user";
export const LIST_USERS_ENDPOINT = "/admin/list-users";
export const RESET_PASSWORD_ENDPOINT = "/admin/reset-password";
export const RESET_MFA_ENDPOINT = "/admin/reset-mfa";
export const USER_DEPARTMENT_ENDPOINT = "/admin/department";

export interface CreateUser {
  givenName: string;
  familyName: string;
  email: string;
  phoneNumber?: string;
  idDepartment?: number;
}

export async function createUser(payload: CreateUser): Promise<void> {
  await api.post(USER_ENDPOINT, payload);
}

export type UserStatus =
  | "CONFIRMED"
  | "UNCONFIRMED"
  | "FORCE_CHANGE_PASSWORD"
  | "RESET_REQUIRED"
  | "ARCHIVED"
  | "COMPROMISED"
  | "UNKNOWN";

const KNOWN_STATUSES: UserStatus[] = [
  "CONFIRMED", "UNCONFIRMED", "FORCE_CHANGE_PASSWORD", "RESET_REQUIRED", "ARCHIVED", "COMPROMISED",
];

export interface AppUser {
  username: string;
  givenName: string;
  familyName: string;
  email: string;
  phoneNumber?: string;
  status: UserStatus;
  idDepartment?: number;
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const parsed = Number(v.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function toStatus(v: unknown): UserStatus {
  const s = str(v).toUpperCase();
  if ((KNOWN_STATUSES as string[]).includes(s)) return s as UserStatus;
  return "UNKNOWN";
}

function normalizeUser(raw: any): AppUser {
  return {
    username: str(raw?.username),
    givenName: str(raw?.given_name),
    familyName: str(raw?.family_name),
    email: str(raw?.email),
    phoneNumber: str(raw?.phone_number) || undefined,
    status: toStatus(raw?.status),
    idDepartment: num(raw?.idDepartment ?? raw?.departmentId ?? raw?.department?.id),
  };
}

export async function listUsers(): Promise<AppUser[]> {
  const { data } = await api.get(LIST_USERS_ENDPOINT);
  if (!Array.isArray(data)) return [];
  return data.map(normalizeUser);
}

export interface UpdateUser {
  email: string;
  givenName: string;
  familyName: string;
  idDepartment?: number;
}

export async function updateUser(payload: UpdateUser): Promise<void> {
  await api.patch(USER_ENDPOINT, {
    email: payload.email.trim(),
    givenName: payload.givenName,
    familyName: payload.familyName,
    idDepartment: payload.idDepartment,
  });
}

export interface SetUserDepartment {
  email: string;
  idDepartment: number;
}

export async function setUserDepartment(payload: SetUserDepartment): Promise<void> {
  await api.post(USER_DEPARTMENT_ENDPOINT, null, {
    params: { id: payload.idDepartment, email: payload.email.trim() },
  });
}

export async function deleteUser(email: string): Promise<void> {
  await api.delete(USER_ENDPOINT, { data: { email: email.trim() } });
}

export async function resetPassword(email: string): Promise<void> {
  await api.post(RESET_PASSWORD_ENDPOINT, null, { params: { email: email.trim() } });
}

export async function resetMFA(email: string): Promise<void> {
  await api.post(RESET_MFA_ENDPOINT, null, { params: { email: email.trim() } });
}
