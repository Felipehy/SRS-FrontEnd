import type { Reservation } from "../../api/service/reservationTypes";

export type CategoryKey = "MEETING_ROOM" | "AUDITORIUM" | "FLEET_VEHICLE";

export type ReservationStatus =
    | "ENVIADA_PARA_ANALISE"
    | "REPROVADA"
    | "APROVADA"
    | "FINALIZADA"
    | "CANCELADA";

export type CalEvent = {
  id: number;
  title: string;
  date: string;
  time: string;
  endTime: string;
  color: string;
  category: CategoryKey;
  attendees?: number;
  location?: string;
  responsavel?: string;
  departamento?: string;
  status: ReservationStatus;
  motivoReprova?: string;
  cafe?: boolean;
  motivoCafe?: string;
  horaMontagemCafe?: string;
  horaServirCafe?: string;
  cafeAprovado?: boolean | null;
  motivoRejeicaoCafe?: string;
  raw?: Reservation;
};
