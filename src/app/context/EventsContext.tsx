import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CategoryKey, CalEvent } from "../types/calendar";
import type { MeetingRoom, Auditorium, FleetVehicle } from "../../api/service/reservationTypes";
import { meetingRoomService, auditoriumService, fleetVehicleService, listarReservasPorPeriodo } from "../../api/service/reservationService";
import type { UserReservation } from "../../api/service/userReservationService";
import { useAuth } from "./AuthContext";

const CATEGORY_COLOR: Record<CategoryKey, string> = {
  MEETING_ROOM: "#0284c7",
  AUDITORIUM: "#5b4fcf",
  FLEET_VEHICLE: "#f59e0b",
};

const CATEGORY_TITLE: Record<CategoryKey, string> = {
  MEETING_ROOM: "Sala de reunião",
  AUDITORIUM: "Auditório",
  FLEET_VEHICLE: "Veículo da frota",
};

function fromListItem(r: UserReservation): CalEvent | null {
  if (!r.category || !r.status) return null;

  let endTime = r.endTime;
  if (!endTime) endTime = r.startTime;

  return {
    id: r.id,
    title: CATEGORY_TITLE[r.category],
    date: r.reservationDate,
    time: r.startTime,
    endTime,
    category: r.category,
    color: CATEGORY_COLOR[r.category],
    status: r.status,
    responsavel: r.userNameRequester || undefined,
  };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

async function fetchCalendarMonth(year: number, month: number): Promise<CalEvent[]> {
  const mes = String(month).padStart(2, "0");
  const inicio = `${year}-${mes}-01`;
  const fim = `${year}-${mes}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}`;

  const lista = await listarReservasPorPeriodo(inicio, fim);

  const events: CalEvent[] = [];
  for (const item of lista) {
    const ev = fromListItem(item);
    if (ev) events.push(ev);
  }
  return events;
}

function fromMeetingRoom(r: MeetingRoom): CalEvent {
  return {
    id: r.id,
    title: r.observation?.trim() || `Reunião — Andar ${r.room.floor}`,
    date: r.reservationDate,
    time: r.startTime,
    endTime: r.endTime,
    category: "MEETING_ROOM",
    color: CATEGORY_COLOR.MEETING_ROOM,
    status: r.status,
    location: r.room.floor,
    attendees: r.numPeople,
    responsavel: r.userNameRequester,
    departamento: r.requesterDepartment ?? undefined,
    motivoReprova: r.reasonFailure ?? undefined,
    cafe: r.coffee,
    motivoCafe: r.reasonCoffee ?? undefined,
    cafeAprovado: r.isApproveCoffee ?? null,
    motivoRejeicaoCafe: r.reasonRejectCoffee ?? undefined,
    raw: r,
  };
}

function fromAuditorium(a: Auditorium): CalEvent {
  const cafe = a.coffeeBreak;
  return {
    id: a.id,
    title: a.reason?.trim() || "Auditório",
    date: a.reservationDate,
    time: a.startTime,
    endTime: a.endTime,
    category: "AUDITORIUM",
    color: CATEGORY_COLOR.AUDITORIUM,
    status: a.status,
    attendees: a.numPeople + (a.numExternalPeople ?? 0),
    responsavel: a.userNameRequester,
    departamento: a.requesterDepartment ?? undefined,
    motivoReprova: a.reasonFailure ?? undefined,
    cafe: cafe?.necessaryCoffee ?? false,
    motivoCafe: cafe?.reasonCoffee ?? undefined,
    horaMontagemCafe: cafe?.foodSetupTime ?? undefined,
    horaServirCafe: cafe?.serviceTime ?? undefined,
    cafeAprovado: cafe?.isApproveCoffeeBreak ?? null,
    motivoRejeicaoCafe: cafe?.reasonRejectCoffee ?? undefined,
    raw: a,
  };
}

function fromFleetVehicle(f: FleetVehicle): CalEvent {
  return {
    id: f.id,
    title: f.reason?.trim() || f.destinationAddress,
    date: f.reservationDate,
    time: f.exitTime,
    endTime: f.returnTime ?? f.exitTime,
    category: "FLEET_VEHICLE",
    color: CATEGORY_COLOR.FLEET_VEHICLE,
    status: f.status,
    location: f.departureAddress,
    attendees: f.quantityPassengers,
    responsavel: f.userNameRequester,
    departamento: f.requesterDepartment ?? undefined,
    motivoReprova: f.reasonFailure ?? undefined,
    raw: f,
  };
}

async function fetchMonthEvents(category: CategoryKey, year: number, month: number): Promise<CalEvent[]> {
  if (category === "MEETING_ROOM") {
    const data = await meetingRoomService.listarPorMesEAno(month, year);
    return data.map(fromMeetingRoom);
  }
  if (category === "AUDITORIUM") {
    const data = await auditoriumService.listarPorMesEAno(month, year);
    return data.map(fromAuditorium);
  }
  const data = await fleetVehicleService.listarPorMesEAno(month, year);
  return data.map(fromFleetVehicle);
}

async function fetchAllEvents(category: CategoryKey): Promise<CalEvent[]> {
  if (category === "MEETING_ROOM") {
    const data = await meetingRoomService.listar();
    return data.map(fromMeetingRoom);
  }
  if (category === "AUDITORIUM") {
    const data = await auditoriumService.listar();
    return data.map(fromAuditorium);
  }
  const data = await fleetVehicleService.listar();
  return data.map(fromFleetVehicle);
}

export async function fetchEventById(category: CategoryKey, id: number): Promise<CalEvent> {
  if (category === "MEETING_ROOM") {
    return fromMeetingRoom(await meetingRoomService.buscarPorId(id));
  }
  if (category === "AUDITORIUM") {
    return fromAuditorium(await auditoriumService.buscarPorId(id));
  }
  return fromFleetVehicle(await fleetVehicleService.buscarPorId(id));
}

function approveById(category: CategoryKey, id: number, approver: string): Promise<void> {
  if (category === "MEETING_ROOM") return meetingRoomService.aprovar(id, approver);
  if (category === "AUDITORIUM") return auditoriumService.aprovar(id, approver);
  return fleetVehicleService.aprovar(id, approver);
}

function rejectById(category: CategoryKey, id: number, reasonFailure: string, approver: string): Promise<void> {
  if (category === "MEETING_ROOM") return meetingRoomService.reprovar(id, reasonFailure, approver);
  if (category === "AUDITORIUM") return auditoriumService.reprovar(id, reasonFailure, approver);
  return fleetVehicleService.reprovar(id, reasonFailure, approver);
}

function cancelById(category: CategoryKey, id: number, reasonCancellation?: string): Promise<void> {
  if (category === "MEETING_ROOM") return meetingRoomService.cancelar(id, reasonCancellation);
  if (category === "AUDITORIUM") return auditoriumService.cancelar(id, reasonCancellation);
  return fleetVehicleService.cancelar(id, reasonCancellation);
}

function approveCoffeeById(category: CategoryKey, id: number): Promise<void> {
  if (category === "MEETING_ROOM") return meetingRoomService.aprovarCafe(id);
  if (category === "AUDITORIUM") return auditoriumService.aprovarCafe(id);
  return Promise.reject(new Error("Esta categoria de reserva não possui café."));
}

function rejectCoffeeById(category: CategoryKey, id: number, reasonRejectCoffee: string): Promise<void> {
  if (category === "MEETING_ROOM") return meetingRoomService.reprovarCafe(id, reasonRejectCoffee);
  if (category === "AUDITORIUM") return auditoriumService.reprovarCafe(id, reasonRejectCoffee);
  return Promise.reject(new Error("Esta categoria de reserva não possui café."));
}

type LoadState = "idle" | "loading" | "success" | "error";

const EMPTY: Record<CategoryKey, CalEvent[]> = { MEETING_ROOM: [], AUDITORIUM: [], FLEET_VEHICLE: [] };

function monthKey(category: CategoryKey, year: number, month: number): string {
  return `${category}:${year}-${String(month).padStart(2, "0")}`;
}

function allKey(category: CategoryKey): string {
  return `${category}:ALL`;
}

function calendarKey(year: number, month: number): string {
  return `CALENDAR:${year}-${String(month).padStart(2, "0")}`;
}

function isInMonth(date: string, year: number, month: number): boolean {
  return date.startsWith(`${year}-${String(month).padStart(2, "0")}`);
}

interface EventsContextValue {
  allEvents: CalEvent[];
  eventsFor: (c: CategoryKey) => CalEvent[];
  loadMonth: (c: CategoryKey, year: number, month: number, force?: boolean) => Promise<void>;
  loadAll: (c: CategoryKey, force?: boolean) => Promise<void>;
  statusFor: (c: CategoryKey, year: number, month: number) => LoadState;
  errorFor: (c: CategoryKey, year: number, month: number) => string | null;
  statusForAll: (c: CategoryKey) => LoadState;
  errorForAll: (c: CategoryKey) => string | null;
  calendarEvents: CalEvent[];
  loadCalendarMonth: (year: number, month: number, force?: boolean) => Promise<void>;
  calendarStatusFor: (year: number, month: number) => LoadState;
  calendarErrorFor: (year: number, month: number) => string | null;
  updateCategoryColor: (c: CategoryKey, color: string) => void;
  addEvent: (ev: CalEvent) => void;
  approveEvent: (id: number, category: CategoryKey) => Promise<void>;
  rejectEvent: (id: number, category: CategoryKey, reasonFailure: string) => Promise<void>;
  cancelEvent: (id: number, category: CategoryKey, reasonCancellation?: string) => Promise<void>;
  approveCoffee: (id: number, category: CategoryKey) => Promise<void>;
  rejectCoffee: (id: number, category: CategoryKey, reasonRejectCoffee: string) => Promise<void>;
  refreshEvent: (id: number, category: CategoryKey) => Promise<void>;
}

const EventsContext = createContext<EventsContextValue | null>(null);

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [byCat, setByCat] = useState(EMPTY);
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);
  const [state, setState] = useState<Record<string, LoadState>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const loadedRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());

  const loadMonth = useCallback(async (category: CategoryKey, year: number, month: number, force = false) => {
    const key = monthKey(category, year, month);
    if (!force && (loadedRef.current.has(key) || inFlightRef.current.has(key))) return;

    inFlightRef.current.add(key);
    setState(p => ({ ...p, [key]: "loading" }));
    setErrors(p => ({ ...p, [key]: null }));
    try {
      const data = await fetchMonthEvents(category, year, month);
      setByCat(p => {
        const others = p[category].filter(ev => !isInMonth(ev.date, year, month));
        return { ...p, [category]: [...others, ...data] };
      });
      setState(p => ({ ...p, [key]: "success" }));
      loadedRef.current.add(key);
    } catch (err: any) {
      loadedRef.current.delete(key);
      setErrors(p => ({ ...p, [key]: err?.detail ?? err?.message ?? "Erro ao carregar" }));
      setState(p => ({ ...p, [key]: "error" }));
    } finally {
      inFlightRef.current.delete(key);
    }
  }, []);

  const loadAll = useCallback(async (category: CategoryKey, force = false) => {
    const key = allKey(category);
    if (!force && (loadedRef.current.has(key) || inFlightRef.current.has(key))) return;

    inFlightRef.current.add(key);
    setState(p => ({ ...p, [key]: "loading" }));
    setErrors(p => ({ ...p, [key]: null }));
    try {
      const data = await fetchAllEvents(category);
      setByCat(p => ({ ...p, [category]: data }));
      setState(p => ({ ...p, [key]: "success" }));
      loadedRef.current.add(key);
    } catch (err: any) {
      loadedRef.current.delete(key);
      setErrors(p => ({ ...p, [key]: err?.detail ?? err?.message ?? "Erro ao carregar" }));
      setState(p => ({ ...p, [key]: "error" }));
    } finally {
      inFlightRef.current.delete(key);
    }
  }, []);

  const loadCalendarMonth = useCallback(async (year: number, month: number, force = false) => {
    const key = calendarKey(year, month);
    if (!force && (loadedRef.current.has(key) || inFlightRef.current.has(key))) return;

    inFlightRef.current.add(key);
    setState(p => ({ ...p, [key]: "loading" }));
    setErrors(p => ({ ...p, [key]: null }));
    try {
      const data = await fetchCalendarMonth(year, month);
      setCalendarEvents(p => {
        const others = p.filter(ev => !isInMonth(ev.date, year, month));
        return [...others, ...data];
      });
      setState(p => ({ ...p, [key]: "success" }));
      loadedRef.current.add(key);
    } catch (err: any) {
      loadedRef.current.delete(key);
      setErrors(p => ({ ...p, [key]: err?.detail ?? err?.message ?? "Erro ao carregar" }));
      setState(p => ({ ...p, [key]: "error" }));
    } finally {
      inFlightRef.current.delete(key);
    }
  }, []);

  const eventsFor = useCallback((c: CategoryKey) => {
    const list = byCat[c];
    if (!list) {
      console.warn(`eventsFor: categoria desconhecida "${c}"`);
      return [];
    }
    return list;
  }, [byCat]);

  const statusFor = useCallback(
    (c: CategoryKey, year: number, month: number) => state[monthKey(c, year, month)] ?? "idle",
    [state],
  );

  const errorFor = useCallback(
    (c: CategoryKey, year: number, month: number) => errors[monthKey(c, year, month)] ?? null,
    [errors],
  );

  const statusForAll = useCallback((c: CategoryKey) => state[allKey(c)] ?? "idle", [state]);
  const errorForAll = useCallback((c: CategoryKey) => errors[allKey(c)] ?? null, [errors]);

  const calendarStatusFor = useCallback(
    (year: number, month: number) => state[calendarKey(year, month)] ?? "idle",
    [state],
  );

  const calendarErrorFor = useCallback(
    (year: number, month: number) => errors[calendarKey(year, month)] ?? null,
    [errors],
  );
  const allEvents = useMemo(() => Object.values(byCat).flat(), [byCat]);

  const updateCategoryColor = useCallback((category: CategoryKey, color: string) => {
    setByCat(p => ({ ...p, [category]: p[category].map(ev => ({ ...ev, color })) }));
  }, []);

  const addEvent = useCallback((ev: CalEvent) => {
    setByCat(p => ({ ...p, [ev.category]: [...p[ev.category], ev] }));
  }, []);

  const patchEvent = useCallback((id: number, category: CategoryKey, patch: Partial<CalEvent>) => {
    setByCat(p => ({
      ...p,
      [category]: p[category].map(ev => (ev.id === id ? { ...ev, ...patch } : ev)),
    }));
    setCalendarEvents(p => p.map(ev => {
      if (ev.id === id && ev.category === category) return { ...ev, ...patch };
      return ev;
    }));
  }, []);

  let approver = "";
  if (user?.nameResolved) approver = user.name;
  if (!approver) approver = user?.email || user?.id || "";

  const requireApprover = () => {
    if (approver) return;
    throw new Error(
      "Não foi possível identificar quem está aprovando. Recarregue a página e, se persistir, avise o suporte."
    );
  };

  const approveEvent = useCallback(
    async (id: number, category: CategoryKey) => {
      requireApprover();
      await approveById(category, id, approver);
      patchEvent(id, category, { status: "APROVADA", motivoReprova: undefined });
    },
    [patchEvent, approver],
  );

  const rejectEvent = useCallback(
    async (id: number, category: CategoryKey, reasonFailure: string) => {
      requireApprover();
      await rejectById(category, id, reasonFailure, approver);
      patchEvent(id, category, { status: "REPROVADA", motivoReprova: reasonFailure });
    },
    [patchEvent, approver],
  );

  const refreshEvent = useCallback(
    async (id: number, category: CategoryKey) => {
      const fresh = await fetchEventById(category, id);
      const { color, ...rest } = fresh;
      patchEvent(id, category, rest);
    },
    [patchEvent],
  );

  const approveCoffee = useCallback(
    async (id: number, category: CategoryKey) => {
      await approveCoffeeById(category, id);
      try {
        await refreshEvent(id, category);
      } catch {
        patchEvent(id, category, { cafeAprovado: true, motivoRejeicaoCafe: undefined });
      }
    },
    [refreshEvent, patchEvent],
  );

  const rejectCoffee = useCallback(
    async (id: number, category: CategoryKey, reasonRejectCoffee: string) => {
      await rejectCoffeeById(category, id, reasonRejectCoffee);
      try {
        await refreshEvent(id, category);
      } catch {
        patchEvent(id, category, { cafeAprovado: false, motivoRejeicaoCafe: reasonRejectCoffee });
      }
    },
    [refreshEvent, patchEvent],
  );

  const cancelEvent = useCallback(
    async (id: number, category: CategoryKey, reasonCancellation?: string) => {
      await cancelById(category, id, reasonCancellation);
      try {
        await refreshEvent(id, category);
      } catch {
        patchEvent(id, category, { status: "CANCELADA" });
      }
    },
    [refreshEvent, patchEvent],
  );

  return (
    <EventsContext.Provider value={{ allEvents, eventsFor, loadMonth, loadAll, statusFor, errorFor, statusForAll, errorForAll, calendarEvents, loadCalendarMonth, calendarStatusFor, calendarErrorFor, updateCategoryColor, addEvent, approveEvent, rejectEvent, cancelEvent, approveCoffee, rejectCoffee, refreshEvent }}>
      {children}
    </EventsContext.Provider>
  );
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error("useEvents must be used inside EventsProvider");
  return ctx;
}

export function useReservations(category: CategoryKey, year: number, month: number) {
  const { eventsFor, loadMonth, statusFor, errorFor } = useEvents();

  useEffect(() => {
    loadMonth(category, year, month);
  }, [category, year, month, loadMonth]);

  return {
    events: eventsFor(category),
    loading: statusFor(category, year, month) === "loading",
    error: errorFor(category, year, month),
  };
}
