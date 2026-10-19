import { api } from "../lib/api";
import { parseGroup, type AppGroup } from "./groupService";
import type { CategoryKey } from "../../app/types/calendar";

export const USER_ENDPOINT = "/user";
export const COLORS_ENDPOINT = "/user/color";
export const TUTORIAL_ENDPOINT = "/user/tutorial";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export type UserColors = Partial<Record<CategoryKey, string>>;

function validHex(v: unknown): string | undefined {
  if (typeof v === "string" && HEX_RE.test(v.trim())) {
    return v.trim().toLowerCase();
  }
  return undefined;
}

export function parseColors(raw: unknown): UserColors | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const src = raw as Record<string, unknown>;

  const meetingRoom = validHex(src.colorMeetingRoom);
  const auditorium = validHex(src.colorAuditorium);
  const fleetVehicle = validHex(src.colorFleetVehicles);

  const out: UserColors = {};
  if (meetingRoom) out.MEETING_ROOM = meetingRoom;
  if (auditorium) out.AUDITORIUM = auditorium;
  if (fleetVehicle) out.FLEET_VEHICLE = fleetVehicle;

  if (Object.keys(out).length === 0) return undefined;
  return out;
}

export async function saveUserColors(colors: Record<CategoryKey, string>): Promise<void> {
  await api.post(COLORS_ENDPOINT, {
    colorMeetingRoom: colors.MEETING_ROOM,
    colorAuditorium: colors.AUDITORIUM,
    colorFleetVehicles: colors.FLEET_VEHICLE,
  });
}

export type NavLayout = "navbar" | "sidebar";

export function parseNavLayout(raw: unknown): NavLayout | undefined {
  if (typeof raw === "boolean") return raw ? "navbar" : "sidebar";
  return undefined;
}

export async function saveUserNavLayout(navLayout: NavLayout): Promise<void> {
  await api.post(USER_ENDPOINT, null, { params: { navbar: navLayout === "navbar" } });
}

export async function saveTutorialDone(): Promise<void> {
  await api.patch(TUTORIAL_ENDPOINT);
}

export function parseUserGroups(raw: unknown): AppGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseGroup).filter(g => g.groupCognito);
}
