import { api } from "../lib/api";
import type { Room } from "./reservationTypes";

export const ROOM_ENDPOINT = "/room";

export type RoomOption = Room & { isActive: boolean };

function parseRoom(raw: any): RoomOption {
  let isActive = true;
  if (typeof raw?.isActive === "boolean") {
    isActive = raw.isActive;
  }
  return {
    id: raw?.id,
    floor: raw?.floor,
    isActive,
  };
}

export const roomService = {
  async listar(): Promise<RoomOption[]> {
    const { data } = await api.get<any[]>(ROOM_ENDPOINT);
    if (!Array.isArray(data)) return [];
    return data.map(parseRoom);
  },

  async listarVisiveis(): Promise<Room[]> {
    const rooms = await roomService.listar();
    const visiveis: Room[] = [];
    for (const room of rooms) {
      if (room.isActive) {
        visiveis.push({ id: room.id, floor: room.floor });
      }
    }
    return visiveis;
  },

  async definirVisibilidade(id: number, isActive: boolean): Promise<void> {
    await api.patch(ROOM_ENDPOINT, null, { params: { id, isActive } });
  },
};
