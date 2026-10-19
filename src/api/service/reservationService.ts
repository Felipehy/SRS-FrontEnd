import { api } from "../lib/api";
import { createReservationService } from "./createReservationService";
import { normalizeReservation, type UserReservation } from "./userReservationService";

import type {
  MeetingRoom,
  CreateMeetingRoom,
  Auditorium,
  CreateAuditorium,
  FleetVehicle,
  CreateFleetVehicle,
} from "./reservationTypes";

export const meetingRoomService = createReservationService<MeetingRoom, CreateMeetingRoom>("/reservation/meeting-room");
export const auditoriumService = createReservationService<Auditorium, CreateAuditorium>("/reservation/auditorium");
export const fleetVehicleService = createReservationService<FleetVehicle, CreateFleetVehicle>("/reservation/fleet-vehicle");

export async function listarReservasPorPeriodo(startTime: string, endTime: string): Promise<UserReservation[]> {
  const { data } = await api.get("/reservation", { params: { startTime, endTime } });

  let lista: any[] = [];
  if (Array.isArray(data?.reservations)) lista = data.reservations;

  return lista.map(normalizeReservation);
}
