import { api } from "../lib/api";
import type { AppUser } from "./userService";

export const LIST_GROUPS_ENDPOINT = "/admin/list-group";
export const GROUP_ENDPOINT = "/admin/group";
export const USER_GROUPS_ENDPOINT = "/admin/user/groups";
export const ADD_USER_GROUP_ENDPOINT = "/admin/user/add-group";
export const REMOVE_USER_GROUP_ENDPOINT = "/admin/user/remove-group";

export const GROUP_NAME_MAX = 128;
export const GROUP_COGNITO_MAX = 128;
export const GROUP_DESCRIPTION_MAX = 2048;

export const DEFAULT_GROUP_COLOR = "#5b4fcf";

export const GROUP_COLOR_PRESETS = [
  "#5b4fcf",
  "#2563eb",
  "#0891b2",
  "#059669",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#7c3aed",
  "#475569",
];

export interface AppGroup {
  groupName: string;
  groupCognito: string;
  colorGroup?: string;
  description?: string;
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

export function normalizeColor(v: unknown): string | undefined {
  let raw = str(v).toLowerCase();
  if (!raw) return undefined;
  if (!raw.startsWith("#")) raw = `#${raw}`;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  return undefined;
}

export function groupColorOf(group: { colorGroup?: string }): string {
  return normalizeColor(group.colorGroup) ?? DEFAULT_GROUP_COLOR;
}

export function parseGroup(raw: any): AppGroup {
  const groupCognito = str(raw?.groupCognito);
  return {
    groupName: str(raw?.groupName) || groupCognito,
    groupCognito,
    colorGroup: normalizeColor(raw?.colorGroup),
    description: str(raw?.description) || undefined,
  };
}

function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  return [];
}

export interface GroupRef {
  groupName: string;
  groupCognito: string;
  colorGroup?: string;
  description?: string;
}

function toGroupRequest(group: GroupRef) {
  const body: Record<string, string> = {
    groupName: group.groupName.trim(),
    groupCognito: group.groupCognito.trim(),
    description: group.description?.trim() ?? "",
  };
  const color = normalizeColor(group.colorGroup);
  if (color) {
    body.colorGroup = color;
  }
  return body;
}

export async function listGroups(): Promise<AppGroup[]> {
  const { data } = await api.get(LIST_GROUPS_ENDPOINT);
  return toArray(data).map(parseGroup).filter(g => g.groupCognito);
}

export type UserRef = Pick<AppUser, "givenName" | "familyName" | "email" | "phoneNumber">;

function toUserRequest(u: UserRef) {
  return {
    givenName: u.givenName,
    familyName: u.familyName,
    email: u.email.trim(),
    phoneNumber: u.phoneNumber ?? "",
  };
}

export async function listGroupsForUser(user: UserRef): Promise<AppGroup[]> {
  const { data } = await api.post(USER_GROUPS_ENDPOINT, toUserRequest(user));
  return toArray(data).map(parseGroup).filter(g => g.groupCognito);
}

export const GROUP_MEMBERS_ENDPOINT = "/admin/groups/users";

export interface GroupMember {
  username: string;
  email: string;
  givenName: string;
  familyName: string;
}

function normalizeMember(raw: any): GroupMember {
  const username = str(raw?.username ?? raw?.sub);
  const email = str(raw?.email ?? raw?.userEmail ?? raw?.emailUser);
  return {
    username,
    email: (email || (username.includes("@") ? username : "")).toLowerCase(),
    givenName: str(raw?.name ?? raw?.givenName ?? raw?.given_name),
    familyName: str(raw?.familyName ?? raw?.family_name),
  };
}

export async function listGroupMembers(group: GroupRef): Promise<GroupMember[]> {
  const { data } = await api.post(GROUP_MEMBERS_ENDPOINT, toGroupRequest(group));
  const list: any[] = Array.isArray(data?.username) ? data.username : [];
  return list.map(normalizeMember).filter(m => m.username || m.email || m.givenName || m.familyName);
}

export function memberNameKey(givenName: string, familyName: string): string {
  const fullName = `${givenName} ${familyName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const tokens = fullName.split(/[^a-z0-9]+/).filter(Boolean);
  const unique: string[] = [];
  for (const token of tokens) {
    if (!unique.includes(token)) unique.push(token);
  }
  return unique.sort().join(" ");
}

export interface UserGroupRef {
  username: string;
  group: string;
}

function toUserGroupsRequest(ref: UserGroupRef) {
  return {
    username: ref.username.trim(),
    group: ref.group.trim(),
  };
}

export async function addUserToGroup(ref: UserGroupRef): Promise<string> {
  const { data } = await api.post(ADD_USER_GROUP_ENDPOINT, toUserGroupsRequest(ref));
  return str(data?.message);
}

export async function removeUserFromGroup(ref: UserGroupRef): Promise<string> {
  const { data } = await api.post(REMOVE_USER_GROUP_ENDPOINT, toUserGroupsRequest(ref));
  return str(data?.message);
}

export interface CreateGroup {
  groupName: string;
  groupCognito: string;
  colorGroup?: string;
  description: string;
}

export async function createGroup(payload: CreateGroup): Promise<void> {
  await api.post(GROUP_ENDPOINT, toGroupRequest(payload));
}

export interface UpdateGroup {
  groupName: string;
  groupCognito: string;
  colorGroup?: string;
  description?: string;
}

export async function updateGroup(payload: UpdateGroup): Promise<string> {
  const { data } = await api.patch(GROUP_ENDPOINT, toGroupRequest(payload));
  return str(data?.message);
}

export async function deleteGroup(group: GroupRef): Promise<string> {
  const { data } = await api.delete(GROUP_ENDPOINT, { data: toGroupRequest(group) });
  return str(data?.message);
}
