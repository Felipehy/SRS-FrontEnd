import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router";
import {
  ChevronLeft, ChevronRight, Plus, Calendar, Clock, Users, Tag, Check,
  Search, X, MapPin, Building2, Mic, Car, RefreshCw, Ban, AlertCircle,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { clsx } from "clsx";
import { MOTIVOS_ABERTURA_AUDITORIO } from "../../config/lists";
import { useEvents, useReservations } from "../context/EventsContext";
import { useCategoryColors } from "../context/CategoryColorsContext";
import { useAuth } from "../context/AuthContext";
import { canCancelReservation, ignoresReservationRules, canBookOverApproved } from "../auth/permissions";
import { DatePicker, TimePicker } from "../components/FormPickers";
import { StatusBadge, StatusDot, statusLabel, CoffeeBadge, coffeeState } from "../components/StatusBadge";
import { ReservationDetails } from "../components/ReservationDetails";
import { useBreakpoint } from "../utils/useBreakpoint";
import { useTutorial } from "../context/TutorialContext";
import { meetingRoomService, auditoriumService, fleetVehicleService } from "../../api/service/reservationService";
import { roomService } from "../../api/service/roomService";
import { departmentService, type Department } from "../../api/service/departmentService";
import type { CreateMeetingRoom, CreateAuditorium, CreateFleetVehicle, Room } from "../../api/service/reservationTypes";

import type { CategoryKey, CalEvent } from "../types/calendar";
export type { CategoryKey, CalEvent };

const CATEGORY_META: Record<CategoryKey, { name: string; shortName: string; color: string; icon: React.ElementType }> = {
  MEETING_ROOM:  { name: "Salas de Reunião",           shortName: "Sala de reunião", color: "#0284c7", icon: Building2 },
  AUDITORIUM:    { name: "Auditório",                  shortName: "Auditório",       color: "#5b4fcf", icon: Mic       },
  FLEET_VEHICLE: { name: "Veículos Oficiais da Frota", shortName: "Frota",           color: "#f59e0b", icon: Car       },
};

const ALL_CATEGORIES: CategoryKey[] = ["MEETING_ROOM", "AUDITORIUM", "FLEET_VEHICLE"];

const BRAND_COLOR = "#5b4fcf";

function eventKey(ev: CalEvent): string {
  return `${ev.category}-${ev.id}`;
}

function filtroInicial(state: any): CategoryKey[] {
  const categoria = state?.categoria;
  if (ALL_CATEGORIES.includes(categoria)) return [categoria];
  return [...ALL_CATEGORIES];
}

const DAYS   = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function getDaysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function getFirstDayOfMonth(y: number, m: number): number {
  return new Date(y, m, 1).getDay();
}

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toDateStr(d: Date): string {
  return formatDate(d.getFullYear(), d.getMonth(), d.getDate());
}

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtTime(t: string): string {
  return t.slice(0, 5);
}

const MIN_HORA_RESERVA = 7;

const ERRO_HORA_MINIMA = `Não é possível reservar antes das ${String(MIN_HORA_RESERVA).padStart(2, "0")}:00`;

function antesDaHoraMinima(t: string): boolean {
  if (!t) return false;
  return toMins(t) < MIN_HORA_RESERVA * 60;
}

const MAX_HORA_COMERCIAL = 19;

const ERRO_MOTIVO_FORA_HORARIO = `Obrigatório para reservas que passam das ${String(MAX_HORA_COMERCIAL).padStart(2, "0")}:00`;

function depoisDaHoraComercial(t: string): boolean {
  if (!t) return false;
  return toMins(t) > MAX_HORA_COMERCIAL * 60;
}

const SHOW_EVENT_TITLE_IN_CHIP = false;

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return "(" + d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type ContatoTipo = "ramal" | "telefone";

function maskRamal(v: string): string {
  return v.replace(/\D/g, "").slice(0, 4);
}

function maskContato(tipo: ContatoTipo, v: string): string {
  if (tipo === "ramal") return maskRamal(v);
  return maskPhone(v);
}

function validateContato(tipo: ContatoTipo, value: string): string | undefined {
  const d = value.replace(/\D/g, "");
  if (!d) return "Obrigatório";
  if (tipo === "ramal") {
    if (d.length === 4) return undefined;
    return "O ramal deve ter 4 dígitos";
  }
  return validateTelefone(value, true);
}

function validateTelefone(value: string, obrigatorio: boolean): string | undefined {
  const d = value.replace(/\D/g, "");
  if (!d) {
    if (obrigatorio) return "Obrigatório";
    return undefined;
  }
  if (d.length >= 10) return undefined;
  return "Telefone incompleto";
}

function contatoParaPayload(tipo: ContatoTipo, value: string): string {
  if (!value) return "";
  if (tipo === "ramal") return `Ramal ${value}`;
  return value;
}

function detectConflict(
  events: CalEvent[], date: string, time: string, endTime: string,
  category: CategoryKey, location: string | undefined, excludeId?: number,
): CalEvent | undefined {
  const ns = toMins(time);
  const ne = toMins(endTime);
  return events.find(ev => {
    if (excludeId !== undefined && ev.id === excludeId) return false;
    if (ev.status !== "APROVADA") return false;
    if (ev.date !== date || ev.category !== category) return false;
    if (category === "MEETING_ROOM" && ev.location !== location) return false;
    const es = toMins(ev.time);
    const ee = toMins(ev.endTime);
    return ns < ee && es < ne;
  });
}

function dataMinimaPara(semRegras: boolean, today: string): string | undefined {
  if (semRegras) return undefined;
  return today;
}

function horaMinimaPara(semRegras: boolean): number {
  if (semRegras) return 0;
  return MIN_HORA_RESERVA;
}

function inputCls(err?: string): string {
  return clsx(
    "w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-xs text-foreground outline-none transition-all placeholder-muted-foreground/50",
    err ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-transparent focus:border-[#5b4fcf]/30 focus:bg-card"
  );
}

function ResponsavelField({ name }: { name: string }) {
  return (
    <div className={clsx(inputCls(), "flex items-center justify-between")}>
      <span>{name || "—"}</span>
      <span className="text-[10px] text-muted-foreground">você</span>
    </div>
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{children}</label>;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p role="alert" className="text-[11px] text-red-500 mt-1">{msg}</p>;
}

function RadioGroup({ name, value, onChange, options }: {
  name: string; value: string; onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="flex gap-4" role="radiogroup">
      {options.map(o => (
        <label key={o.value} className="flex items-center gap-2 cursor-pointer">
          <div
            role="radio"
            aria-checked={value === o.value}
            tabIndex={0}
            onClick={() => onChange(o.value)}
            onKeyDown={e => {
              if (e.key === " " || e.key === "Enter") onChange(o.value);
            }}
            className="flex space-x-1"
          >
            <div
              className={clsx(
                "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer",
                value === o.value ? "border-[#5b4fcf]" : "border-border"
              )}
            >
              {value === o.value && <div className="w-2 h-2 rounded-full bg-[#5b4fcf]" />}
            </div>
            <span className="text-xs text-foreground">{o.label}</span>
          </div>
        </label>
      ))}
    </div>
  );
}

const SIM_NAO = [{ label: "Sim", value: "sim" }, { label: "Não", value: "nao" }];

function cafeAguaResumo(valor: string): string {
  if (valor === "sim") return "Sim — necessário";
  if (valor === "nao") return "Não necessário";
  return "Clique para selecionar";
}

function useUserDepartment() {
  const { user } = useAuth();
  const userId = user?.userId;
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setDepartment(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    departmentService.buscarDoUsuario(userId)
      .then(d => { if (alive) setDepartment(d); })
      .catch((err: any) => {
        if (!alive) return;
        if (err?.status === 404) {
          setDepartment(null);
          return;
        }
        setError(err?.detail ?? err?.message ?? "Não foi possível carregar o seu departamento.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  return { departmentName: department?.name ?? "", loading, error };
}

function departmentHint(loading: boolean, error: string | null, name: string): string | undefined {
  if (error) return error;
  if (!loading && !name) return "Seu usuário não tem departamento vinculado. Fale com o administrador.";
  return undefined;
}

function DepartmentField({ name, loading, error }: { name: string; loading: boolean; error: string | null }) {
  let texto = name;
  if (!texto) {
    if (error) texto = "Erro ao carregar";
    else if (loading) texto = "Carregando…";
    else texto = "Sem departamento";
  }
  return (
    <div aria-busy={loading} className={clsx(inputCls(), "flex items-center justify-between")}>
      <span className={name ? "" : "text-muted-foreground"}>{texto}</span>
      <span className="text-[10px] text-muted-foreground">seu departamento</span>
    </div>
  );
}

function ContactField({ id, tipo, value, onTipoChange, onValueChange, error }: {
  id: string; tipo: ContatoTipo; value: string;
  onTipoChange: (t: ContatoTipo) => void; onValueChange: (v: string) => void; error?: string;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <select
        id={`${id}-tipo`}
        aria-label="Tipo de contato"
        value={tipo}
        onChange={e => onTipoChange(e.target.value as ContatoTipo)}
        className={inputCls()}
      >
        <option value="ramal">Ramal</option>
        <option value="telefone">Telefone</option>
      </select>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        value={value}
        maxLength={tipo === "ramal" ? 4 : 15}
        onChange={e => onValueChange(maskContato(tipo, e.target.value))}
        placeholder={tipo === "ramal" ? "Ex.: 1234" : "(00) 00000-0000"}
        className={inputCls(error)}
      />
    </div>
  );
}

function TelefoneField({ id, value, onChange, error }: {
  id: string; value: string; onChange: (v: string) => void; error?: string;
}) {
  return (
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      value={value}
      maxLength={15}
      onChange={e => onChange(maskPhone(e.target.value))}
      placeholder="(00) 00000-0000"
      className={inputCls(error)}
    />
  );
}

function ConflictBanner({ conflict }: { conflict: CalEvent }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
      <div>
        <p className="text-xs font-semibold text-red-600">Conflito de horário</p>
        <p className="text-[11px] text-red-500 mt-0.5">
          A reserva aprovada "{conflict.title}" ocupa {fmtTime(conflict.time)}–{fmtTime(conflict.endTime)}
          {conflict.location ? ` na ${conflict.location}` : " nesta data"}.
          {" "}Escolha outro horário{conflict.location ? " ou sala" : ""}.
        </p>
      </div>
    </div>
  );
}

function FormActions({ onClose, disabled, color, submitting }: { onClose: () => void; disabled: boolean; color: string; submitting?: boolean }) {
  const tutorial = useTutorial();

  function handleConfirmClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (tutorial.active) e.preventDefault();
  }

  return (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={onClose} disabled={submitting}
        className="flex-1 py-3 rounded-xl cursor-pointer border border-border text-sm text-muted-foreground hover:opacity-80 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed">
        Cancelar
      </button>
      <button type="submit" data-tour="form-confirmar" onClick={handleConfirmClick} disabled={disabled}
        className={clsx("flex-1 py-3 rounded-xl text-sm cursor-pointer font-medium text-white transition-all",
          disabled ? "opacity-40 cursor-not-allowed" : "hover:opacity-80")}
        style={{ background: disabled ? "#9ca3af" : color }}>
        {submitting ? "Enviando…" : "Criar reserva"}
      </button>
    </div>
  );
}

function SubmitError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
      <p className="text-[11px] text-red-500">{msg}</p>
    </div>
  );
}

const MAX_MOTIVO_CAFE = 250;
const MAX_OBSERVACAO = 1000;
const MAX_MOTIVO_FORA_HORARIO = 300;

function MotivoCafeField({ id, label, value, onChange, error, obrigatorio = true }: {
  id: string; label: string; value: string; onChange: (v: string) => void; error?: string; obrigatorio?: boolean;
}) {
  let textoLabel = label;
  if (obrigatorio) textoLabel = label + " *";

  let placeholder = "Explique por que o café é necessário…";
  if (!obrigatorio) placeholder = "Opcional…";

  return (
    <div>
      <FieldLabel htmlFor={id}>{textoLabel}</FieldLabel>
      <textarea
        id={id}
        value={value}
        maxLength={MAX_MOTIVO_CAFE}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className={clsx(inputCls(error), "resize-none")}
      />
      <div className="flex justify-between items-start gap-2 mt-1">
        <FieldError msg={error} />
        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{value.length}/{MAX_MOTIVO_CAFE}</span>
      </div>
    </div>
  );
}

function MotivoForaHorarioField({ id, value, onChange, error, obrigatorio = true }: {
  id: string; value: string; onChange: (v: string) => void; error?: string; obrigatorio?: boolean;
}) {
  let textoLabel = `Motivo do uso após as ${String(MAX_HORA_COMERCIAL).padStart(2, "0")}:00`;
  if (obrigatorio) textoLabel = textoLabel + " *";

  return (
    <div>
      <FieldLabel htmlFor={id}>{textoLabel}</FieldLabel>
      <textarea
        id={id}
        value={value}
        maxLength={MAX_MOTIVO_FORA_HORARIO}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder="Explique por que a reserva precisa passar do horário de expediente…"
        className={clsx(inputCls(error), "resize-none")}
      />
      <div className="flex justify-between items-start gap-2 mt-1">
        <FieldError msg={error} />
        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{value.length}/{MAX_MOTIVO_FORA_HORARIO}</span>
      </div>
    </div>
  );
}

function CafeAguaModal({ current, currentMotivo, onConfirm, onClose }: {
  current: string; currentMotivo: string;
  onConfirm: (v: string, motivo: string) => void; onClose: () => void;
}) {
  const [choice, setChoice] = useState(current || "");
  const [motivo, setMotivo] = useState(currentMotivo || "");

  function handleConfirm() {
    if (choice === "sim") {
      onConfirm(choice, motivo.trim());
    } else {
      onConfirm(choice, "");
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card rounded-2xl shadow-2xl w-80 p-6 border border-border"
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <h3 className="text-base font-semibold text-foreground mb-1">Café e água</h3>
        <p className="text-xs text-muted-foreground mb-4">Há necessidade de café e água para este evento?</p>
        <RadioGroup name="cafe" value={choice} onChange={v => setChoice(v)} options={SIM_NAO} />
        {choice === "sim" && (
          <div className="mt-4">
            <MotivoCafeField
              id="s-motivo-cafe"
              label="Motivo do café"
              value={motivo}
              onChange={v => setMotivo(v)}
              obrigatorio={false}
            />
          </div>
        )}
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button type="button" disabled={!choice} onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-[#0284c7] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

type SalasForm = { date: string; sala: string; timeStart: string; timeEnd: string; motivoForaHorario: string; pessoas: string; divisao: string; contatoTipo: ContatoTipo; telefone: string; cafeAgua: string; motivoCafe: string; observacoes: string; };

function FormSalas({ initialDate, onSave, onClose }: {
  initialDate: string; onSave: (reservationDate: string) => void; onClose: () => void;
}) {
  const today = toDateStr(new Date());
  const { user } = useAuth();
  const tutorial = useTutorial();
  const [f, setF] = useState<SalasForm>({ date: initialDate, sala: "", timeStart: "09:00", timeEnd: "10:00", motivoForaHorario: "", pessoas: "", divisao: "", contatoTipo: "ramal", telefone: "", cafeAgua: "", motivoCafe: "", observacoes: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof SalasForm, string>>>({});
  const [cafeModal, setCafeModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (k: keyof SalasForm, v: string) => {
    setF(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  const setContatoTipo = (t: ContatoTipo) => {
    setF(p => ({ ...p, contatoTipo: t, telefone: "" }));
    setErrors(p => ({ ...p, telefone: undefined }));
  };

  const [salas, setSalas] = useState<Room[]>([]);
  const [salasLoading, setSalasLoading] = useState(true);
  const [salasError, setSalasError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    roomService.listarVisiveis()
      .then(rooms => { if (alive) setSalas(rooms); })
      .catch((err: any) => { if (alive) setSalasError(err?.detail ?? err?.message ?? "Não foi possível carregar as salas."); })
      .finally(() => { if (alive) setSalasLoading(false); });
    return () => { alive = false; };
  }, []);

  const { departmentName, loading: departmentLoading, error: departmentError } = useUserDepartment();

  useEffect(() => {
    setF(p => ({ ...p, divisao: departmentName }));
    setErrors(p => ({ ...p, divisao: undefined }));
  }, [departmentName]);

  const semSalas = !salasLoading && !salasError && salas.length === 0;

  const [anoReserva, mesReserva] = (f.date || initialDate).split("-").map(Number);
  const { events: reservasDeSala } = useReservations("MEETING_ROOM", anoReserva, mesReserva);

  const semRegras = ignoresReservationRules(user);
  const sobreAprovadas = canBookOverApproved(user);

  const conflict = !sobreAprovadas && f.sala && f.date && f.timeStart && f.timeEnd
    ? detectConflict(reservasDeSala, f.date, f.timeStart, f.timeEnd, "MEETING_ROOM", f.sala)
    : undefined;

  const foraDoHorario = depoisDaHoraComercial(f.timeEnd);

  const validate = () => {
    const e: Partial<Record<keyof SalasForm, string>> = {};
    if (!f.date) e.date = "Data inválida ou no passado";
    else if (!semRegras && f.date < today) e.date = "Data inválida ou no passado";
    if (!f.sala) e.sala = "Selecione uma sala";
    if (!f.timeStart) e.timeStart = "Obrigatório";
    else if (!semRegras && antesDaHoraMinima(f.timeStart)) e.timeStart = ERRO_HORA_MINIMA;
    if (!f.timeEnd) e.timeEnd = "Obrigatório";
    else if (!semRegras && antesDaHoraMinima(f.timeEnd)) e.timeEnd = ERRO_HORA_MINIMA;
    if (!semRegras && f.timeEnd && f.timeStart && toMins(f.timeEnd) <= toMins(f.timeStart)) e.timeEnd = "Deve ser maior que o início";
    if (!semRegras && foraDoHorario && !f.motivoForaHorario.trim()) e.motivoForaHorario = ERRO_MOTIVO_FORA_HORARIO;
    if (!f.pessoas || parseInt(f.pessoas) < 1) e.pessoas = "Mínimo 1 pessoa";
    if (!semRegras && !f.divisao) e.divisao = "Seu usuário não tem departamento vinculado";
    const errContato = validateContato(f.contatoTipo, f.telefone);
    if (errContato) e.telefone = errContato;
    if (!f.cafeAgua) e.cafeAgua = "Informe se há necessidade de café — clique no botão acima";
    if (conflict) e.timeStart = `Conflito com "${conflict.title}" (${conflict.time}–${conflict.endTime})`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tutorial.active) return;
    if (!validate()) return;

    let motivoCafe = "";
    if (f.cafeAgua === "sim") motivoCafe = f.motivoCafe.trim();

    let motivoForaHorario = "";
    if (foraDoHorario) motivoForaHorario = f.motivoForaHorario.trim();

    const payload: CreateMeetingRoom = {
      reservationDate: f.date,
      roomId: salas.find(s => s.floor === f.sala)?.id ?? 0,
      startTime: f.timeStart,
      endTime: f.timeEnd,
      reasonOutsideHours: motivoForaHorario,
      userNameRequester: user?.name ?? "",
      requesterDepartment: f.divisao,
      numPeople: parseInt(f.pessoas),
      isCoffee: f.cafeAgua === "sim",
      reasonCoffee: motivoCafe,
      observation: f.observacoes,
      userId: user?.userId ?? null,
      telephone: contatoParaPayload(f.contatoTipo, f.telefone),
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      await meetingRoomService.criar(payload);
      onSave(payload.reservationDate);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.detail ?? err?.message ?? "Erro ao criar a reserva. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div data-tour="campo-data">
          <FieldLabel htmlFor="s-date">Data *</FieldLabel>
          <DatePicker id="s-date" value={f.date} onChange={v => handleChange("date", v)} minDate={dataMinimaPara(semRegras, today)} error={errors.date} placeholder="Selecione a data" />
          <FieldError msg={errors.date} />
        </div>
        <div data-tour="sala-sala">
          <FieldLabel htmlFor="s-sala">Sala *</FieldLabel>
          <select id="s-sala" aria-busy={salasLoading} value={f.sala} onChange={e => handleChange("sala", e.target.value)} className={inputCls(errors.sala)} disabled={!!salasError || salas.length === 0}>
            <option value="">
              {salasError ? "Erro ao carregar salas" : salasLoading ? "Carregando salas…" : semSalas ? "Nenhuma sala disponível" : "Selecione"}
            </option>
            {salas.map(s => <option key={s.id} value={s.floor}>{s.floor}</option>)}
          </select>
          <FieldError msg={errors.sala ?? salasError ?? (semSalas ? "Nenhuma sala liberada para reserva. Fale com o administrador." : undefined)} />
        </div>
      </div>
      <div data-tour="sala-horario" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="s-ts">Horário de início *</FieldLabel>
          <TimePicker id="s-ts" value={f.timeStart} onChange={v => handleChange("timeStart", v)} error={errors.timeStart} minHour={horaMinimaPara(semRegras)} />
          <FieldError msg={errors.timeStart} />
        </div>
        <div>
          <FieldLabel htmlFor="s-te">Horário de término *</FieldLabel>
          <TimePicker id="s-te" value={f.timeEnd} onChange={v => handleChange("timeEnd", v)} error={errors.timeEnd} minHour={horaMinimaPara(semRegras)} />
          <FieldError msg={errors.timeEnd} />
        </div>
      </div>
      {foraDoHorario && (
        <MotivoForaHorarioField
          id="s-motivo-fora-horario"
          value={f.motivoForaHorario}
          onChange={v => handleChange("motivoForaHorario", v)}
          error={errors.motivoForaHorario}
          obrigatorio={!semRegras}
        />
      )}
      {conflict && <ConflictBanner conflict={conflict} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div data-tour="sala-pessoas">
          <FieldLabel htmlFor="s-pess">Qtd. de pessoas *</FieldLabel>
          <input id="s-pess" type="number" min={1} value={f.pessoas} onChange={e => handleChange("pessoas", e.target.value)} placeholder="1" className={inputCls(errors.pessoas)} />
          <FieldError msg={errors.pessoas} />
        </div>
        <div data-tour="campo-divisao">
          <FieldLabel>Divisão solicitante</FieldLabel>
          <DepartmentField name={f.divisao} loading={departmentLoading} error={departmentError} />
          <FieldError msg={errors.divisao ?? departmentHint(departmentLoading, departmentError, f.divisao)} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div data-tour="campo-responsavel">
          <FieldLabel>Servidor responsável</FieldLabel>
          <ResponsavelField name={user?.name ?? ""} />
        </div>
        <div data-tour="campo-contato">
          <FieldLabel htmlFor="s-tel">Contato *</FieldLabel>
          <ContactField
            id="s-tel"
            tipo={f.contatoTipo}
            value={f.telefone}
            onTipoChange={setContatoTipo}
            onValueChange={v => handleChange("telefone", v)}
            error={errors.telefone}
          />
          <FieldError msg={errors.telefone} />
        </div>
      </div>
      <div data-tour="sala-cafe">
        <FieldLabel>Necessidade de café e água *</FieldLabel>
        <button type="button" onClick={() => setCafeModal(true)}
          className={clsx("w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs transition-all",
            errors.cafeAgua ? "border-red-300 bg-red-50 dark:bg-red-950/30 text-red-600"
              : f.cafeAgua ? "border-[#0284c7]/30 bg-[#0284c7]/5 text-foreground"
              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted")}>
          <span>{cafeAguaResumo(f.cafeAgua)}</span>
          <ChevronRight size={12} />
        </button>
        <FieldError msg={errors.cafeAgua} />
        {f.cafeAgua === "sim" && f.motivoCafe && (
          <p className="text-[11px] text-muted-foreground mt-1 break-words">Motivo: {f.motivoCafe}</p>
        )}
        {cafeModal && (
          <CafeAguaModal
            current={f.cafeAgua}
            currentMotivo={f.motivoCafe}
            onConfirm={(v, motivo) => {
              setF(p => ({ ...p, cafeAgua: v, motivoCafe: motivo }));
              setErrors(p => ({ ...p, cafeAgua: undefined }));
            }}
            onClose={() => setCafeModal(false)}
          />
        )}
      </div>
      <div data-tour="campo-observacoes">
        <FieldLabel htmlFor="s-obs">Observações</FieldLabel>
        <textarea id="s-obs" value={f.observacoes} maxLength={MAX_OBSERVACAO} onChange={e => handleChange("observacoes", e.target.value)} rows={2} placeholder="Opcional…" className={clsx(inputCls(), "resize-none")} />
        <span className="block text-[10px] text-muted-foreground text-right mt-1">{f.observacoes.length}/{MAX_OBSERVACAO}</span>
      </div>
      <SubmitError msg={submitError} />
      <FormActions onClose={onClose} disabled={!!conflict || submitting} color="#0284c7" submitting={submitting} />
    </form>
  );
}

type AuditorioForm = { date: string; timeAbertura: string; timeEvento: string; timeFim: string; motivoAbertura: string; motivoForaHorario: string; pessoasInternas: string; publicoExterno: string; pessoasExternas: string; assunto: string; divisao: string; contatoTipo: ContatoTipo; telefone: string; email: string; telao: string; som: string; coffeeBreak: string; horaMontagemCafe: string; horaServirCafe: string; motivoCoffeeBreak: string; observacoes: string; };

const MAX_PUBLICO_AUDITORIO = 100;

const MAX_MOTIVO_ABERTURA = 400;

const MIN_MINUTOS_MONTAGEM_CAFE = 30;

const MIN_MINUTOS_MONTAGEM_ATE_SERVIR = 10;

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function limiteMontagemCafe(fim: string): number {
  return toMins(fim) - MIN_MINUTOS_MONTAGEM_CAFE;
}

function validarMontagemCafe(montagem: string, abertura: string, fim: string): string | undefined {
  if (!abertura || !fim) return undefined;
  const limite = limiteMontagemCafe(fim);
  if (limite < toMins(abertura)) return `A reserva é curta demais: a montagem precisa ser ${MIN_MINUTOS_MONTAGEM_CAFE} min antes do fim`;
  if (toMins(montagem) < toMins(abertura)) return `Deve ser a partir da abertura (${abertura})`;
  if (toMins(montagem) > limite) return `Deve ser no mínimo ${MIN_MINUTOS_MONTAGEM_CAFE} min antes do fim (até ${minsToTime(limite)})`;
  return undefined;
}

function validarServirCafe(servir: string, montagem: string, fim: string): string | undefined {
  if (fim && toMins(servir) > toMins(fim)) return `Deve ser até o fim da reserva (${fim})`;
  if (!montagem) return undefined;
  const minimo = toMins(montagem) + MIN_MINUTOS_MONTAGEM_ATE_SERVIR;
  if (toMins(servir) < minimo) return `Deve ser no mínimo ${MIN_MINUTOS_MONTAGEM_ATE_SERVIR} min depois da montagem (a partir de ${minsToTime(minimo)})`;
  return undefined;
}

function dicaMontagemCafe(abertura: string, fim: string): string {
  if (!abertura || !fim) return "";
  const limite = limiteMontagemCafe(fim);
  if (limite < toMins(abertura)) return "";
  return `A montagem deve ser entre ${abertura} e ${minsToTime(limite)}.`;
}

function totalPublico(internas: string, externas: string): number {
  let total = parseInt(internas);
  if (isNaN(total)) total = 0;
  let ext = parseInt(externas);
  if (isNaN(ext)) ext = 0;
  return total + ext;
}

function FormAuditorio({ initialDate, events, onSave, onClose }: {
  initialDate: string; events: CalEvent[]; onSave: (reservationDate: string) => void; onClose: () => void;
}) {
  const today = toDateStr(new Date());
  const { user } = useAuth();
  const tutorial = useTutorial();
  const [f, setF] = useState<AuditorioForm>({ date: initialDate, timeAbertura: "08:00", timeEvento: "09:00", timeFim: "10:00", motivoAbertura: "", motivoForaHorario: "", pessoasInternas: "", publicoExterno: "", pessoasExternas: "", assunto: "", divisao: "", contatoTipo: "ramal", telefone: "", email: "", telao: "", som: "", coffeeBreak: "", horaMontagemCafe: "", horaServirCafe: "", motivoCoffeeBreak: "", observacoes: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof AuditorioForm | "conflict", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (k: keyof AuditorioForm, v: string) => {
    setF(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined, conflict: undefined }));
  };

  const setContatoTipo = (t: ContatoTipo) => {
    setF(p => ({ ...p, contatoTipo: t, telefone: "" }));
    setErrors(p => ({ ...p, telefone: undefined }));
  };

  const { departmentName, loading: departmentLoading, error: departmentError } = useUserDepartment();

  useEffect(() => {
    setF(p => ({ ...p, divisao: departmentName }));
    setErrors(p => ({ ...p, divisao: undefined }));
  }, [departmentName]);

  const abeDifEvento = f.timeAbertura && f.timeEvento && f.timeAbertura !== f.timeEvento;

  const foraDoHorario = depoisDaHoraComercial(f.timeFim);

  const totalPessoas = totalPublico(f.pessoasInternas, f.pessoasExternas);

  const semRegras = ignoresReservationRules(user);
  const sobreAprovadas = canBookOverApproved(user);

  const conflict = !sobreAprovadas && f.date && f.timeAbertura && f.timeFim
    ? detectConflict(events, f.date, f.timeAbertura, f.timeFim, "AUDITORIUM", undefined)
    : undefined;

  let maxPublico: number | undefined = MAX_PUBLICO_AUDITORIO;
  if (semRegras) maxPublico = undefined;

  let labelMotivoAbertura = "Motivo da diferença de horário *";
  if (semRegras) labelMotivoAbertura = "Motivo da diferença de horário";

  let dicaMontagem = "";
  if (!semRegras) dicaMontagem = dicaMontagemCafe(f.timeAbertura, f.timeFim);

  let coffeeBreak = f.coffeeBreak;
  if (tutorial.step?.coffeeForm) coffeeBreak = "sim";

  const validate = () => {
    const e: Partial<Record<keyof AuditorioForm | "conflict", string>> = {};
    if (!f.date) e.date = "Data inválida ou no passado";
    else if (!semRegras && f.date < today) e.date = "Data inválida ou no passado";
    if (!f.timeAbertura) e.timeAbertura = "Obrigatório";
    else if (!semRegras && antesDaHoraMinima(f.timeAbertura)) e.timeAbertura = ERRO_HORA_MINIMA;
    if (!f.timeEvento) e.timeEvento = "Obrigatório";
    else if (!semRegras && antesDaHoraMinima(f.timeEvento)) e.timeEvento = ERRO_HORA_MINIMA;
    if (!f.timeFim) e.timeFim = "Obrigatório";
    else if (!semRegras && antesDaHoraMinima(f.timeFim)) e.timeFim = ERRO_HORA_MINIMA;
    if (!semRegras && f.timeEvento && f.timeAbertura && toMins(f.timeEvento) < toMins(f.timeAbertura)) e.timeEvento = "Deve ser ≥ horário de abertura";
    if (!semRegras && f.timeFim && f.timeEvento && toMins(f.timeFim) <= toMins(f.timeEvento)) e.timeFim = "Deve ser maior que o início";
    if (!semRegras && abeDifEvento && !f.motivoAbertura.trim()) e.motivoAbertura = "Obrigatório quando os horários diferem";
    if (!semRegras && foraDoHorario && !f.motivoForaHorario.trim()) e.motivoForaHorario = ERRO_MOTIVO_FORA_HORARIO;
    const internas = parseInt(f.pessoasInternas);
    if (!f.pessoasInternas || internas < 1) e.pessoasInternas = "Mínimo 1 pessoa";
    if (!f.publicoExterno) e.publicoExterno = "Obrigatório";
    if (f.publicoExterno === "sim") {
      const ext = parseInt(f.pessoasExternas);
      if (!f.pessoasExternas || ext < 1) e.pessoasExternas = "Mínimo 1 pessoa";
    }
    if (!semRegras && totalPessoas > MAX_PUBLICO_AUDITORIO) e.pessoasInternas = `O auditório comporta ${MAX_PUBLICO_AUDITORIO} pessoas (total: ${totalPessoas})`;
    if (!f.assunto.trim()) e.assunto = "Obrigatório";
    if (!semRegras && !f.divisao) e.divisao = "Seu usuário não tem departamento vinculado";
    const errContato = validateContato(f.contatoTipo, f.telefone);
    if (errContato) e.telefone = errContato;
    if (!f.email) e.email = "Obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = "E-mail inválido";
    if (!f.telao) e.telao = "Obrigatório";
    if (!f.som) e.som = "Obrigatório";
    if (!f.coffeeBreak) e.coffeeBreak = "Obrigatório";
    if (f.coffeeBreak === "sim") {
      if (!f.horaMontagemCafe) {
        e.horaMontagemCafe = "Obrigatório";
      } else if (!semRegras) {
        const erroMontagem = validarMontagemCafe(f.horaMontagemCafe, f.timeAbertura, f.timeFim);
        if (erroMontagem) e.horaMontagemCafe = erroMontagem;
      }
      if (!f.horaServirCafe) {
        e.horaServirCafe = "Obrigatório";
      } else if (!semRegras) {
        const erroServir = validarServirCafe(f.horaServirCafe, f.horaMontagemCafe, f.timeFim);
        if (erroServir) e.horaServirCafe = erroServir;
      }
      if (!f.motivoCoffeeBreak.trim()) e.motivoCoffeeBreak = "Obrigatório quando há coffee break";
    }
    if (conflict) e.conflict = `Conflito com "${conflict.title}"`;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tutorial.active) return;
    if (!validate()) return;

    let motivoCafe = "";
    let horaMontagemCafe: string | null = null;
    let horaServirCafe: string | null = null;
    if (f.coffeeBreak === "sim") {
      motivoCafe = f.motivoCoffeeBreak.trim();
      horaMontagemCafe = f.horaMontagemCafe;
      horaServirCafe = f.horaServirCafe;
    }

    let motivoAbertura = "";
    if (abeDifEvento) motivoAbertura = f.motivoAbertura.trim();

    let motivoForaHorario = "";
    if (foraDoHorario) motivoForaHorario = f.motivoForaHorario.trim();

    let pessoasExternas = 0;
    if (f.publicoExterno === "sim") pessoasExternas = parseInt(f.pessoasExternas);

    const payload: CreateAuditorium = {
      reservationDate: f.date,
      timeOpenAuditorium: f.timeAbertura,
      reasonOpenAuditorium: motivoAbertura,
      reason: f.assunto.trim(),
      startTime: f.timeEvento,
      endTime: f.timeFim,
      reasonOutsideHours: motivoForaHorario,
      userNameRequester: user?.name ?? "",
      requesterDepartment: f.divisao,
      numPeople: parseInt(f.pessoasInternas),
      externalPublic: f.publicoExterno === "sim",
      necessaryScreen: f.telao === "sim",
      necessarySoundSystem: f.som === "sim",
      necessaryCoffee: f.coffeeBreak === "sim",
      foodSetupTime: horaMontagemCafe,
      serviceTime: horaServirCafe,
      reasonCoffee: motivoCafe,
      observation: f.observacoes.trim(),
      userId: user?.userId ?? null,
      telephone: contatoParaPayload(f.contatoTipo, f.telefone),
      numExternalPeople: pessoasExternas,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      await auditoriumService.criar(payload);
      onSave(payload.reservationDate);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.detail ?? err?.message ?? "Erro ao criar a reserva. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div data-tour="campo-data">
        <FieldLabel htmlFor="a-date">Data *</FieldLabel>
        <DatePicker id="a-date" value={f.date} onChange={v => handleChange("date", v)} minDate={dataMinimaPara(semRegras, today)} error={errors.date} placeholder="Selecione a data" />
        <FieldError msg={errors.date} />
      </div>
      <div data-tour="aud-horarios" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <FieldLabel htmlFor="a-tab">Abertura *</FieldLabel>
          <TimePicker id="a-tab" value={f.timeAbertura} onChange={v => handleChange("timeAbertura", v)} error={errors.timeAbertura} minHour={horaMinimaPara(semRegras)} />
          <FieldError msg={errors.timeAbertura} />
        </div>
        <div>
          <FieldLabel htmlFor="a-tev">Início do evento *</FieldLabel>
          <TimePicker id="a-tev" value={f.timeEvento} onChange={v => handleChange("timeEvento", v)} error={errors.timeEvento} minHour={horaMinimaPara(semRegras)} />
          <FieldError msg={errors.timeEvento} />
        </div>
        <div>
          <FieldLabel htmlFor="a-tfim">Fim do evento *</FieldLabel>
          <TimePicker id="a-tfim" value={f.timeFim} onChange={v => handleChange("timeFim", v)} error={errors.timeFim} minHour={horaMinimaPara(semRegras)} />
          <FieldError msg={errors.timeFim} />
        </div>
      </div>
      {abeDifEvento && (
        <div>
          <FieldLabel htmlFor="a-motivo">{labelMotivoAbertura}</FieldLabel>
          <textarea
            id="a-motivo"
            value={f.motivoAbertura}
            maxLength={MAX_MOTIVO_ABERTURA}
            onChange={e => handleChange("motivoAbertura", e.target.value)}
            rows={3}
            placeholder="Descreva o motivo pelo qual o auditório abrirá antes do início do evento…"
            className={clsx(inputCls(errors.motivoAbertura), "resize-none")}
          />
          <div className="flex justify-between items-start gap-2 mt-1">
            <FieldError msg={errors.motivoAbertura} />
            <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{f.motivoAbertura.length}/{MAX_MOTIVO_ABERTURA}</span>
          </div>
        </div>
      )}
      {foraDoHorario && (
        <MotivoForaHorarioField
          id="a-motivo-fora-horario"
          value={f.motivoForaHorario}
          onChange={v => handleChange("motivoForaHorario", v)}
          error={errors.motivoForaHorario}
          obrigatorio={!semRegras}
        />
      )}
      {conflict && <ConflictBanner conflict={conflict} />}
      <div data-tour="aud-publico" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="a-int">Pessoas da SIURB *</FieldLabel>
          <input id="a-int" type="number" min={1} max={maxPublico} value={f.pessoasInternas} onChange={e => handleChange("pessoasInternas", e.target.value)} placeholder="0" className={inputCls(errors.pessoasInternas)} />
          <FieldError msg={errors.pessoasInternas} />
        </div>
        <div>
          <FieldLabel>Público externo? *</FieldLabel>
          <RadioGroup name="externo" value={f.publicoExterno} onChange={v => handleChange("publicoExterno", v)} options={SIM_NAO} />
          <FieldError msg={errors.publicoExterno} />
        </div>
      </div>
      {f.publicoExterno === "sim" && (
        <div>
          <FieldLabel htmlFor="a-ext">Qtd. de pessoas externas *</FieldLabel>
          <input id="a-ext" type="number" min={1} max={maxPublico} value={f.pessoasExternas} onChange={e => handleChange("pessoasExternas", e.target.value)} placeholder="0" className={inputCls(errors.pessoasExternas)} />
          <FieldError msg={errors.pessoasExternas} />
        </div>
      )}
      {totalPessoas > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Público total: {totalPessoas} de {MAX_PUBLICO_AUDITORIO} lugares
        </p>
      )}
      <div data-tour="aud-assunto">
        <FieldLabel htmlFor="a-ass">Assunto do evento *</FieldLabel>
        <input id="a-ass" value={f.assunto} onChange={e => handleChange("assunto", e.target.value)} placeholder="Descreva o assunto…" className={inputCls(errors.assunto)} />
        <FieldError msg={errors.assunto} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div data-tour="campo-divisao">
          <FieldLabel>Divisão responsável</FieldLabel>
          <DepartmentField name={f.divisao} loading={departmentLoading} error={departmentError} />
          <FieldError msg={errors.divisao ?? departmentHint(departmentLoading, departmentError, f.divisao)} />
        </div>
        <div data-tour="campo-responsavel">
          <FieldLabel>Servidor responsável</FieldLabel>
          <ResponsavelField name={user?.name ?? ""} />
        </div>
      </div>
      <div data-tour="campo-contato">
        <FieldLabel htmlFor="a-tel">Contato *</FieldLabel>
        <ContactField
          id="a-tel"
          tipo={f.contatoTipo}
          value={f.telefone}
          onTipoChange={setContatoTipo}
          onValueChange={v => handleChange("telefone", v)}
          error={errors.telefone}
        />
        <FieldError msg={errors.telefone} />
      </div>
      <div data-tour="aud-email">
        <FieldLabel htmlFor="a-email">E-mail *</FieldLabel>
        <input id="a-email" type="email" value={f.email} onChange={e => handleChange("email", e.target.value)} placeholder="email@dominio.com" className={inputCls(errors.email)} />
        <FieldError msg={errors.email} />
      </div>
      <div data-tour="aud-recursos" className="space-y-3">
        <div>
          <FieldLabel>Uso do telão? *</FieldLabel>
          <RadioGroup name="telao" value={f.telao} onChange={v => handleChange("telao", v)} options={SIM_NAO} />
          <FieldError msg={errors.telao} />
        </div>
        <div>
          <FieldLabel>Uso do sistema de som? *</FieldLabel>
          <RadioGroup name="som" value={f.som} onChange={v => handleChange("som", v)} options={SIM_NAO} />
          <FieldError msg={errors.som} />
        </div>
        <div>
          <FieldLabel>Coffee Break? *</FieldLabel>
          <RadioGroup name="coffeeBreak" value={coffeeBreak} onChange={v => handleChange("coffeeBreak", v)} options={SIM_NAO} />
          <FieldError msg={errors.coffeeBreak} />
          {coffeeBreak === "sim" && (
            <div className="mt-3 rounded-xl border border-border p-3 space-y-3">
              <div data-tour="aud-cafe-horarios" className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FieldLabel htmlFor="a-cafe-montagem">Horário de montagem *</FieldLabel>
                    <TimePicker id="a-cafe-montagem" value={f.horaMontagemCafe} onChange={v => handleChange("horaMontagemCafe", v)} error={errors.horaMontagemCafe} minHour={horaMinimaPara(semRegras)} />
                    <FieldError msg={errors.horaMontagemCafe} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="a-cafe-servir">Horário de servir *</FieldLabel>
                    <TimePicker id="a-cafe-servir" value={f.horaServirCafe} onChange={v => handleChange("horaServirCafe", v)} error={errors.horaServirCafe} minHour={horaMinimaPara(semRegras)} />
                    <FieldError msg={errors.horaServirCafe} />
                  </div>
                </div>
                {dicaMontagem && <p className="text-[11px] text-muted-foreground">{dicaMontagem}</p>}
              </div>
              <div data-tour="aud-cafe-motivo">
                <MotivoCafeField
                  id="a-motivo-cafe"
                  label="Motivo do coffee break"
                  value={f.motivoCoffeeBreak}
                  onChange={v => handleChange("motivoCoffeeBreak", v)}
                  error={errors.motivoCoffeeBreak}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div data-tour="campo-observacoes">
        <FieldLabel htmlFor="a-obs">Observações</FieldLabel>
        <textarea id="a-obs" value={f.observacoes} maxLength={MAX_OBSERVACAO} onChange={e => handleChange("observacoes", e.target.value)} rows={2} placeholder="Opcional…" className={clsx(inputCls(), "resize-none")} />
        <span className="block text-[10px] text-muted-foreground text-right mt-1">{f.observacoes.length}/{MAX_OBSERVACAO}</span>
      </div>
      <SubmitError msg={submitError} />
      <FormActions onClose={onClose} disabled={!!conflict || submitting} color="#5b4fcf" submitting={submitting} />
    </form>
  );
}

const MAX_MOTIVO_FORA_MUNICIPIO = 300;

type FrotaForm = { date: string; horaSaida: string; motivo: string; endSaida: string; endDestino: string; foraMunicipio: string; motivoForaMunicipio: string; retorno: string; horaRetorno: string; endRetornoSaida: string; endRetornoDestino: string; van: string; justVan: string; passageiros: string; divisao: string; contatoTipo: ContatoTipo; contato: string; telefone: string; };

function FormFrota({ initialDate, events, onSave, onClose }: {
  initialDate: string; events: CalEvent[]; onSave: (reservationDate: string) => void; onClose: () => void;
}) {
  const today = toDateStr(new Date());
  const { user } = useAuth();
  const tutorial = useTutorial();
  const [f, setF] = useState<FrotaForm>({ date: initialDate, horaSaida: "08:00", motivo: "", endSaida: "", endDestino: "", foraMunicipio: "", motivoForaMunicipio: "", retorno: "", horaRetorno: "", endRetornoSaida: "", endRetornoDestino: "", van: "", justVan: "", passageiros: "", divisao: "", contatoTipo: "ramal", contato: "", telefone: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof FrotaForm, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (k: keyof FrotaForm, v: string) => {
    setF(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  };

  const setContatoTipo = (t: ContatoTipo) => {
    setF(p => ({ ...p, contatoTipo: t, contato: "" }));
    setErrors(p => ({ ...p, contato: undefined }));
  };

  const { departmentName, loading: departmentLoading, error: departmentError } = useUserDepartment();

  useEffect(() => {
    setF(p => ({ ...p, divisao: departmentName }));
    setErrors(p => ({ ...p, divisao: undefined }));
  }, [departmentName]);

  const maxPass = f.van === "sim" ? 15 : 4;

  const semRegras = ignoresReservationRules(user);

  let maxPassInput: number | undefined = maxPass;
  if (semRegras) maxPassInput = undefined;

  let labelPassageiros = `Quantidade de passageiros * (máx. ${maxPass})`;
  if (semRegras) labelPassageiros = "Quantidade de passageiros *";

  const validate = () => {
    const e: Partial<Record<keyof FrotaForm, string>> = {};
    if (!f.date) e.date = "Data inválida ou no passado";
    else if (!semRegras && f.date < today) e.date = "Data inválida ou no passado";
    if (!f.horaSaida) e.horaSaida = "Obrigatório";
    if (!f.motivo.trim()) e.motivo = "Obrigatório";
    if (!f.endSaida.trim()) e.endSaida = "Obrigatório";
    if (!f.endDestino.trim()) e.endDestino = "Obrigatório";
    if (!f.foraMunicipio) e.foraMunicipio = "Obrigatório";
    if (f.foraMunicipio === "sim" && !f.motivoForaMunicipio.trim()) e.motivoForaMunicipio = "Obrigatório";
    if (!f.retorno) e.retorno = "Obrigatório";
    if (f.retorno === "sim") {
      if (!f.horaRetorno) e.horaRetorno = "Obrigatório";
      if (!f.endRetornoSaida.trim()) e.endRetornoSaida = "Obrigatório";
      if (!f.endRetornoDestino.trim()) e.endRetornoDestino = "Obrigatório";
    }
    if (!f.van) e.van = "Obrigatório";
    if (f.van === "sim" && !f.justVan.trim()) e.justVan = "Justificativa obrigatória";
    const p = parseInt(f.passageiros);
    if (semRegras) {
      if (!f.passageiros || p < 1) e.passageiros = "Mínimo 1 passageiro";
    } else if (!f.passageiros || p < 1 || p > maxPass) {
      e.passageiros = `Entre 1 e ${maxPass} passageiros`;
    }
    if (!semRegras && !f.divisao) e.divisao = "Seu usuário não tem departamento vinculado";
    const errContato = validateContato(f.contatoTipo, f.contato);
    if (errContato) e.contato = errContato;
    const errTelefone = validateTelefone(f.telefone, false);
    if (errTelefone) e.telefone = errTelefone;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tutorial.active) return;
    if (!validate()) return;

    const isVan = f.van === "sim";
    const hasReturn = f.retorno === "sim";
    const isForaMunicipio = f.foraMunicipio === "sim";
    const payload: CreateFleetVehicle = {
      reservationDate: f.date,
      exitTime: f.horaSaida,
      reason: f.motivo.trim(),
      departureAddress: f.endSaida.trim(),
      destinationAddress: f.endDestino.trim(),
      isOutsideTheMunicipality: isForaMunicipio,
      reasonOutsideTheMunicipality: isForaMunicipio ? f.motivoForaMunicipio.trim() : null,
      necessaryReturn: hasReturn,
      returnTime: hasReturn ? f.horaRetorno : null,
      departureAddressReturn: hasReturn ? f.endRetornoSaida.trim() : null,
      destinationAddressReturn: hasReturn ? f.endRetornoDestino.trim() : null,
      contact: contatoParaPayload(f.contatoTipo, f.contato),
      userNameRequester: user?.name ?? "",
      requesterDepartment: f.divisao,
      necessaryVan: isVan,
      reasonUseVan: isVan ? f.justVan.trim() : null,
      typeVehicle: isVan ? "VAN" : "CARRO",
      quantityPassengers: parseInt(f.passageiros),
      userId: user?.userId ?? null,
      telephone: f.telefone,
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      await fleetVehicleService.criar(payload);
      onSave(payload.reservationDate);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.detail ?? err?.message ?? "Erro ao criar a reserva. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div data-tour="campo-data">
          <FieldLabel htmlFor="f-date">Data *</FieldLabel>
          <DatePicker id="f-date" value={f.date} onChange={v => handleChange("date", v)} minDate={dataMinimaPara(semRegras, today)} error={errors.date} placeholder="Selecione a data" />
          <FieldError msg={errors.date} />
        </div>
        <div data-tour="frota-saida">
          <FieldLabel htmlFor="f-hs">Horário de saída *</FieldLabel>
          <TimePicker id="f-hs" value={f.horaSaida} onChange={v => handleChange("horaSaida", v)} error={errors.horaSaida} />
          <FieldError msg={errors.horaSaida} />
        </div>
      </div>
      <div data-tour="frota-motivo">
        <FieldLabel htmlFor="f-motivo">Motivo da solicitação *</FieldLabel>
        <textarea
          id="f-motivo"
          value={f.motivo}
          onChange={e => handleChange("motivo", e.target.value)}
          rows={3}
          placeholder="Descreva o motivo da solicitação do veículo…"
          className={clsx(inputCls(errors.motivo), "resize-none")}
        />
        <FieldError msg={errors.motivo} />
      </div>
      <div data-tour="frota-end-saida">
        <FieldLabel htmlFor="f-es">Endereço de saída *</FieldLabel>
        <input id="f-es" value={f.endSaida} onChange={e => handleChange("endSaida", e.target.value)} placeholder="Rua, número, bairro…" className={inputCls(errors.endSaida)} />
        <FieldError msg={errors.endSaida} />
      </div>
      <div data-tour="frota-fora-municipio">
        <FieldLabel>O endereço é fora do município? *</FieldLabel>
        <RadioGroup name="foraMunicipio" value={f.foraMunicipio} onChange={v => handleChange("foraMunicipio", v)} options={SIM_NAO} />
        <FieldError msg={errors.foraMunicipio} />
        {f.foraMunicipio === "sim" && (
          <div className="mt-3">
            <FieldLabel htmlFor="f-fmun">Motivo da saída do município *</FieldLabel>
            <textarea
              id="f-fmun"
              value={f.motivoForaMunicipio}
              maxLength={MAX_MOTIVO_FORA_MUNICIPIO}
              onChange={e => handleChange("motivoForaMunicipio", e.target.value)}
              rows={3}
              placeholder="Explique por que o deslocamento sai do município…"
              className={clsx(inputCls(errors.motivoForaMunicipio), "resize-none")}
            />
            <div className="flex justify-between items-start gap-2 mt-1">
              <FieldError msg={errors.motivoForaMunicipio} />
              <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{f.motivoForaMunicipio.length}/{MAX_MOTIVO_FORA_MUNICIPIO}</span>
            </div>
          </div>
        )}
      </div>
      <div data-tour="frota-end-destino">
        <FieldLabel htmlFor="f-ed">Endereço de destino *</FieldLabel>
        <input id="f-ed" value={f.endDestino} onChange={e => handleChange("endDestino", e.target.value)} placeholder="Rua, número, bairro…" className={inputCls(errors.endDestino)} />
        <FieldError msg={errors.endDestino} />
      </div>
      <div data-tour="frota-retorno">
        <FieldLabel>Necessidade de retorno? *</FieldLabel>
        <RadioGroup name="retorno" value={f.retorno} onChange={v => handleChange("retorno", v)} options={SIM_NAO} />
        <FieldError msg={errors.retorno} />
      </div>
      {f.retorno === "sim" && (
        <div className="space-y-3 pl-4 border-l-2 border-[#f59e0b]/30">
          <div>
            <FieldLabel htmlFor="f-hr">Horário do retorno *</FieldLabel>
            <TimePicker id="f-hr" value={f.horaRetorno} onChange={v => handleChange("horaRetorno", v)} error={errors.horaRetorno} />
            <FieldError msg={errors.horaRetorno} />
          </div>
          <div>
            <FieldLabel htmlFor="f-ers">Endereço de saída do retorno *</FieldLabel>
            <input id="f-ers" value={f.endRetornoSaida} onChange={e => handleChange("endRetornoSaida", e.target.value)} placeholder="Rua, número, bairro…" className={inputCls(errors.endRetornoSaida)} />
            <FieldError msg={errors.endRetornoSaida} />
          </div>
          <div>
            <FieldLabel htmlFor="f-erd">Endereço de destino do retorno *</FieldLabel>
            <input id="f-erd" value={f.endRetornoDestino} onChange={e => handleChange("endRetornoDestino", e.target.value)} placeholder="Rua, número, bairro…" className={inputCls(errors.endRetornoDestino)} />
            <FieldError msg={errors.endRetornoDestino} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div data-tour="campo-divisao">
          <FieldLabel>Divisão solicitante</FieldLabel>
          <DepartmentField name={f.divisao} loading={departmentLoading} error={departmentError} />
          <FieldError msg={errors.divisao ?? departmentHint(departmentLoading, departmentError, f.divisao)} />
        </div>
        <div data-tour="campo-responsavel">
          <FieldLabel>Servidor responsável</FieldLabel>
          <ResponsavelField name={user?.name ?? ""} />
        </div>
      </div>
      <div data-tour="frota-van">
        <FieldLabel>Necessidade de utilização da VAN? *</FieldLabel>
        <RadioGroup
          name="van"
          value={f.van}
          onChange={v => {
            handleChange("van", v);
            setF(p => ({ ...p, passageiros: "" }));
          }}
          options={SIM_NAO}
        />
        <FieldError msg={errors.van} />
      </div>
      {f.van === "sim" && (
        <div>
          <FieldLabel htmlFor="f-jvan">Justificativa da VAN *</FieldLabel>
          <textarea id="f-jvan" value={f.justVan} onChange={e => handleChange("justVan", e.target.value)} rows={2} placeholder="Descreva a justificativa…" className={clsx(inputCls(errors.justVan), "resize-none")} />
          <FieldError msg={errors.justVan} />
        </div>
      )}
      {f.van !== "" && (
        <div>
          <FieldLabel htmlFor="f-pass">{labelPassageiros}</FieldLabel>
          <input id="f-pass" type="number" min={1} max={maxPassInput} value={f.passageiros}
            onChange={e => {
              const val = e.target.value;
              const p = parseInt(val);
              if (!semRegras && (f.van === "" || f.van === "nao") && !isNaN(p) && p >= 5) {
                setF(prev => ({ ...prev, passageiros: val, van: "sim" }));
                setErrors(prev => ({ ...prev, passageiros: undefined, van: undefined }));
              } else {
                handleChange("passageiros", val);
              }
            }}
            placeholder="0" className={inputCls(errors.passageiros)} />
          <FieldError msg={errors.passageiros} />
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div data-tour="campo-contato">
          <FieldLabel htmlFor="f-cont">Contato *</FieldLabel>
          <ContactField
            id="f-cont"
            tipo={f.contatoTipo}
            value={f.contato}
            onTipoChange={setContatoTipo}
            onValueChange={v => handleChange("contato", v)}
            error={errors.contato}
          />
          <FieldError msg={errors.contato} />
        </div>
        <div data-tour="frota-telefone">
          <FieldLabel htmlFor="f-tel">Telefone</FieldLabel>
          <TelefoneField id="f-tel" value={f.telefone} onChange={v => handleChange("telefone", v)} error={errors.telefone} />
          <FieldError msg={errors.telefone} />
        </div>
      </div>
      <SubmitError msg={submitError} />
      <FormActions onClose={onClose} disabled={submitting} color="#f59e0b" submitting={submitting} />
    </form>
  );
}

function CategoryPicker({ value, colors, onChange }: {
  value: CategoryKey | null; colors: Record<CategoryKey, string>; onChange: (c: CategoryKey) => void;
}) {
  return (
    <div data-tour="reserva-tipos" className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="O que você quer reservar?">
      {ALL_CATEGORIES.map(c => {
        const meta = CATEGORY_META[c];
        const Icon = meta.icon;
        const color = colors[c];
        const ativo = value === c;
        return (
          <button key={c} type="button" role="radio" aria-checked={ativo} data-tour={"tipo-" + c} onClick={() => onChange(c)}
            className={clsx("flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-medium transition-all",
              ativo ? "text-foreground" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50")}
            style={ativo ? { borderColor: color, background: color + "15" } : {}}>
            <Icon size={16} style={{ color }} />
            <span className="text-center leading-tight">{meta.shortName}</span>
          </button>
        );
      })}
    </div>
  );
}

function EventModal({ date, initialCategory, events, onClose, onSave }: {
  date: string; initialCategory: CategoryKey | null; events: CalEvent[];
  onClose: () => void; onSave: (reservationDate: string) => void;
}) {
  const { colors } = useCategoryColors();
  const tutorial = useTutorial();
  const tutorialStep = tutorial.step;
  const [category, setCategory] = useState<CategoryKey | null>(initialCategory);

  let headerColor = BRAND_COLOR;
  if (category) headerColor = colors[category];

  useEffect(() => {
    if (tutorialStep && tutorialStep.modal) setCategory(tutorialStep.category);
  }, [tutorialStep]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !tutorial.active) onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose, tutorial.active]);

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div data-tour-frame="" className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg mx-3 sm:mx-4 max-h-[92dvh] flex flex-col"
        style={{ animation: "modalIn 0.18s cubic-bezier(0.34,1.56,0.64,1)" }}>
        <div className="px-4 sm:px-6 pt-6 pb-4 flex items-start justify-between flex-shrink-0 border-b border-border" style={{ borderColor: headerColor + "30" }}>
          <div>
            {category && (
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: headerColor }} />
                <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{CATEGORY_META[category].name}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground capitalize mb-0.5">{displayDate}</p>
            <h2 style={{ fontFamily: "'Blinker', sans-serif" }} className="text-2xl text-foreground">Nova reserva</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 sm:px-6 pb-6 overflow-y-auto pt-4 space-y-4" style={{ scrollbarWidth: "none" }}>
          <div>
            <FieldLabel>O que você quer reservar? *</FieldLabel>
            <CategoryPicker value={category} colors={colors} onChange={setCategory} />
          </div>
          {category === null && (
            <p className="text-xs text-muted-foreground text-center py-6">Escolha uma opção acima para abrir o formulário.</p>
          )}
          {category === "MEETING_ROOM"  && <FormSalas     initialDate={date} onSave={onSave} onClose={onClose} />}
          {category === "AUDITORIUM"    && <FormAuditorio initialDate={date} events={events} onSave={onSave} onClose={onClose} />}
          {category === "FLEET_VEHICLE" && <FormFrota     initialDate={date} events={events} onSave={onSave} onClose={onClose} />}
          {tutorial.active && <div className="h-[45dvh]" aria-hidden="true" />}
        </div>
      </div>
      <style>{`@keyframes modalIn { from{opacity:0;transform:scale(0.93) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }`}</style>
    </div>
  );
}

function EventDetailsModal({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const meta = CATEGORY_META[event.category];
  const cafeState = coffeeState(event);
  const { refreshEvent, cancelEvent } = useEvents();
  const { user } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const podeCancelar = canCancelReservation(user, event);

  useEffect(() => {
    let alive = true;
    setSyncing(true);
    setSyncError(null);
    refreshEvent(event.id, event.category)
      .catch((err: any) => {
        if (alive) setSyncError(err?.detail ?? err?.message ?? "Não foi possível atualizar os dados.");
      })
      .finally(() => { if (alive) setSyncing(false); });
    return () => { alive = false; };
  }, [event.id, event.category, refreshEvent]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !cancelando) onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose, cancelando]);

  const handleCancelar = async () => {
    setCancelando(true);
    setCancelError(null);
    try {
      await cancelEvent(event.id, event.category);
      onClose();
    } catch (err: any) {
      setCancelError(err?.detail ?? err?.message ?? "Não foi possível cancelar a reserva. Tente novamente.");
    } finally {
      setCancelando(false);
    }
  };

  const displayDate = new Date(event.date + "T12:00:00")
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !cancelando) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Detalhes da reserva"
        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg mx-3 sm:mx-4 max-h-[92dvh] flex flex-col"
        style={{ animation: "modalIn 0.18s cubic-bezier(0.34,1.56,0.64,1)" }}>

        <div className="px-4 sm:px-6 pt-6 pb-4 flex items-start justify-between flex-shrink-0 border-b border-border"
          style={{ borderColor: meta.color + "30" }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: event.color }} />
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{meta.name}</span>
            </div>
            <p className="text-xs text-muted-foreground capitalize mb-1">{displayDate}</p>
            <h2 style={{ fontFamily: "'Blinker', sans-serif" }} className="text-2xl text-foreground leading-snug break-words">
              {event.title}
            </h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <StatusBadge status={event.status} />
              {cafeState !== "sem-cafe" && <CoffeeBadge state={cafeState} />}
              {syncing && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <RefreshCw size={10} className="animate-spin" /> Atualizando
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" disabled={cancelando}
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mt-0.5 flex-shrink-0 disabled:opacity-60 disabled:cursor-default">
            <X size={16} />
          </button>
        </div>

        {confirmandoCancelamento ? (
          <div className="px-4 sm:px-6 pb-4 pt-4 overflow-y-auto space-y-4" style={{ scrollbarWidth: "none" }}>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Cancelar esta reserva?</p>
              <p className="text-xs text-muted-foreground">
                A reserva passa para o status "Cancelada" e o horário volta a ficar livre.
                Esta ação não pode ser desfeita.
              </p>
            </div>

            {cancelError && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <AlertCircle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{cancelError}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="px-4 sm:px-6 pb-4 pt-4 overflow-y-auto space-y-3" style={{ scrollbarWidth: "none" }}>
            {syncError && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-500 font-semibold mb-0.5">
                  Dados podem estar desatualizados
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-300 break-words">{syncError}</p>
              </div>
            )}

            {event.status === "REPROVADA" && event.motivoReprova && (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mb-0.5">Motivo da reprova</p>
                <p className="text-xs text-red-700 dark:text-red-300 break-words">{event.motivoReprova}</p>
              </div>
            )}

            <ReservationDetails event={event} />
          </div>
        )}

        <div className="px-4 sm:px-6 py-4 border-t border-border flex items-center justify-between gap-2 flex-shrink-0">
          {confirmandoCancelamento ? (
            <>
              <button onClick={() => setConfirmandoCancelamento(false)} disabled={cancelando}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60 disabled:cursor-default">
                Voltar
              </button>
              <button onClick={handleCancelar} disabled={cancelando}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-default">
                <Ban size={13} /> {cancelando ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
            </>
          ) : (
            <>
              {podeCancelar ? (
                <button onClick={() => setConfirmandoCancelamento(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors">
                  <Ban size={13} /> Cancelar reserva
                </button>
              ) : <span />}
              <button onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: meta.color }}>
                Fechar
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes modalIn { from{opacity:0;transform:scale(0.93) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }`}</style>
    </div>
  );
}

function buildMonthCells(year: number, month: number, fillWeeks: boolean): (number | null)[] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(day);
  }
  if (fillWeeks) {
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
  }
  return cells;
}

function MiniCalendar({ year, month, selectedDate, events, large, onSelect, onMonthChange }: {
  year: number; month: number; selectedDate: string; events: CalEvent[]; large?: boolean;
  onSelect: (d: string) => void; onMonthChange: (y: number, m: number) => void;
}) {
  const today = toDateStr(new Date());
  const cells = buildMonthCells(year, month, false);

  const prev = () => {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  };

  const next = () => {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  };

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-3">
        <span className={clsx("font-medium text-sidebar-foreground/90", large ? "text-base" : "text-sm")}>{MONTHS[month].slice(0, 3)} {year}</span>
        <div className="flex gap-1">
          <button onClick={prev} aria-label="Mês anterior" className={clsx("rounded hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors", large ? "p-2" : "p-0.5")}><ChevronLeft size={large ? 17 : 14} /></button>
          <button onClick={next} aria-label="Próximo mês"  className={clsx("rounded hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors", large ? "p-2" : "p-0.5")}><ChevronRight size={large ? 17 : 14} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["D","S","T","Q","Q","S","S"].map((d, i) => (
          <span key={i} className={clsx("text-center text-sidebar-foreground/30 font-medium py-1", large ? "text-xs" : "text-[10px]")}>{d}</span>
        ))}
      </div>
      <div className={clsx("grid grid-cols-7", large ? "gap-y-1" : "gap-y-0.5")}>
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const date = formatDate(year, month, day);
          const isToday    = date === today;
          const isSelected = date === selectedDate;
          const hasEvents  = events.some(e => e.date === date);
          return (
            <button key={i} onClick={() => onSelect(date)} aria-label={date} aria-pressed={isSelected}
              className={clsx("relative flex items-center justify-center mx-auto rounded-full transition-all",
                large ? "text-sm h-8 w-8" : "text-[11px] h-6 w-6",
                isSelected && "bg-sidebar-foreground text-sidebar font-semibold",
                isToday && !isSelected && "text-sidebar-primary font-semibold",
                !isSelected && !isToday && "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent")}>
              {day}
              {hasEvents && !isSelected && <span className={clsx("absolute left-1/2 -translate-x-1/2 rounded-full bg-sidebar-primary", large ? "bottom-1 w-1 h-1" : "bottom-0.5 w-0.5 h-0.5")} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ year, month, selectedDate, events, todayStr, color, dense, onSelectDate, onDoubleClick, onEventClick }: {
  year: number; month: number; selectedDate: string; events: CalEvent[];
  todayStr: string; color: string; dense?: boolean;
  onSelectDate: (d: string) => void; onDoubleClick: (d: string) => void;
  onEventClick: (ev: CalEvent) => void;
}) {
  const cells = buildMonthCells(year, month, true);
  const maxChips = dense ? 2 : 3;

  return (
    <div data-tour="cal-grade" className={clsx("flex-1 min-w-0 overflow-auto", dense ? "p-3" : "p-6")}>
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map(d => <div key={d} className={clsx("text-center font-medium text-muted-foreground py-2 tracking-wide uppercase", dense ? "text-[10px]" : "text-xs")}>{d}</div>)}
      </div>
      <div className={clsx("grid grid-cols-7", dense ? "gap-1" : "gap-1.5")}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} className={clsx("rounded-xl bg-muted/30", dense ? "h-20" : "h-28")} />;
          const date       = formatDate(year, month, day);
          const isToday    = date === todayStr;
          const isSelected = date === selectedDate;
          const dayEvents  = events.filter(e => e.date === date);
          return (
            <button key={i} onClick={() => onSelectDate(date)} onDoubleClick={() => onDoubleClick(date)}
              aria-label={`${day} de ${MONTHS[month]}`} aria-pressed={isSelected}
              className={clsx("rounded-xl text-left transition-all flex flex-col hover:shadow-sm",
                dense ? "h-20 p-1.5" : "h-28 p-2.5",
                isSelected ? "bg-card ring-2 shadow-md" : "bg-card/60 hover:bg-card")}
              style={isSelected ? ({ "--tw-ring-color": color + "50" } as React.CSSProperties) : {}}>
              <span className={clsx("font-medium flex items-center justify-center rounded-full mb-1 flex-shrink-0",
                dense ? "text-xs w-6 h-6" : "text-sm w-7 h-7",
                isToday ? "text-white" : "text-foreground")}
                style={isToday ? { background: color } : {}}>
                {day}
              </span>
              <div className="flex-1 overflow-hidden space-y-0.5">
                {dayEvents.slice(0, maxChips).map((ev, ei) => (
                  <div key={ei}
                    role="button" tabIndex={0}
                    title={`${CATEGORY_META[ev.category].shortName} · ${fmtTime(ev.time)}–${fmtTime(ev.endTime)} · ${statusLabel(ev.status)}`}
                    onClick={e => { e.stopPropagation(); onSelectDate(date); onEventClick(ev); }}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onSelectDate(date); onEventClick(ev); } }}
                    className="@container flex items-center gap-1 text-[10px] leading-tight px-1 py-0.5 rounded-md text-white font-medium cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ background: ev.color }}>
                    <StatusDot status={ev.status} size={12} />
                    <span className="truncate hidden @min-[2.75rem]:inline">
                      {SHOW_EVENT_TITLE_IN_CHIP ? `${fmtTime(ev.time)} ${ev.title}` : fmtTime(ev.time)}
                    </span>
                    <span className="ml-auto hidden @min-[7rem]:inline text-[9px] text-white/90 whitespace-nowrap">
                      {statusLabel(ev.status)}
                    </span>
                  </div>
                ))}
                {dayEvents.length > maxChips && <span className="text-[9px] text-muted-foreground pl-1">+{dayEvents.length - maxChips} mais</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const HOUR_START = 7;
const HOUR_END = 21;
const TOTAL_HOURS = HOUR_END - HOUR_START;
const CELL_H = 56;

const CELL_H_DENSE = 44;

function eventTop(ev: CalEvent, cellH: number): number {
  return (toMins(ev.time) - HOUR_START * 60) / 60 * cellH;
}

function eventHeight(ev: CalEvent, cellH: number): number {
  return Math.max((toMins(ev.endTime) - toMins(ev.time)) / 60 * cellH, 20);
}

const MIN_DURACAO_VISUAL = 30;

type EventoPosicionado = { ev: CalEvent; coluna: number; totalColunas: number };

function organizarColunas(events: CalEvent[]): EventoPosicionado[] {
  const ordenados = [...events].sort((a, b) => toMins(a.time) - toMins(b.time));
  const resultado: EventoPosicionado[] = [];
  let grupo: EventoPosicionado[] = [];
  let fimColunas: number[] = [];
  let fimGrupo = 0;

  for (const ev of ordenados) {
    const inicio = toMins(ev.time);
    const fim = Math.max(toMins(ev.endTime), inicio + MIN_DURACAO_VISUAL);

    if (grupo.length > 0 && inicio >= fimGrupo) {
      for (const item of grupo) item.totalColunas = fimColunas.length;
      grupo = [];
      fimColunas = [];
    }

    let coluna = fimColunas.findIndex(f => f <= inicio);
    if (coluna === -1) {
      coluna = fimColunas.length;
      fimColunas.push(fim);
    } else {
      fimColunas[coluna] = fim;
    }

    const item = { ev, coluna, totalColunas: 1 };
    grupo.push(item);
    resultado.push(item);
    if (grupo.length === 1 || fim > fimGrupo) fimGrupo = fim;
  }

  for (const item of grupo) item.totalColunas = fimColunas.length;
  return resultado;
}

function colunaStyle(item: EventoPosicionado, espaco: number): React.CSSProperties {
  const largura = 100 / item.totalColunas;
  return {
    left: `calc(${item.coluna * largura}% + ${espaco}px)`,
    width: `calc(${largura}% - ${espaco * 2}px)`,
  };
}

function WeekView({ selectedDate, events, todayStr, color, dense, onSelectDate, onDoubleClick, onEventClick }: {
  selectedDate: string; events: CalEvent[]; todayStr: string; color: string; dense?: boolean;
  onSelectDate: (d: string) => void; onDoubleClick: (d: string) => void;
  onEventClick: (ev: CalEvent) => void;
}) {
  const anchor = new Date(selectedDate + "T12:00:00");
  const sunday = new Date(anchor);
  sunday.setDate(anchor.getDate() - anchor.getDay());

  const weekDays: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    weekDays.push(toDateStr(d));
  }

  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);
  const cellH = dense ? CELL_H_DENSE : CELL_H;
  const gutter = dense ? "w-9" : "w-14";

  return (
    <div data-tour="cal-grade" className="flex-1 min-w-0 overflow-auto" style={{ scrollbarWidth: "none" }}>
      <div className="flex sticky top-0 bg-background z-10 border-b border-border">
        <div className={clsx("flex-shrink-0", gutter)} />
        {weekDays.map(date => {
          const d = new Date(date + "T12:00:00");
          const isToday    = date === todayStr;
          const isSelected = date === selectedDate;
          return (
            <button key={date} onClick={() => onSelectDate(date)}
              className="flex-1 min-w-0 flex flex-col items-center py-2 gap-0.5 hover:bg-muted/50 transition-colors">
              <span className="text-[10px] text-muted-foreground uppercase">{DAYS[d.getDay()]}</span>
              <span className={clsx("font-semibold flex items-center justify-center rounded-full",
                dense ? "text-xs w-6 h-6" : "text-sm w-7 h-7",
                isToday && "text-white", isSelected && !isToday && "ring-2", !isToday && "text-foreground")}
                style={isToday ? { background: color } : isSelected ? ({ "--tw-ring-color": color } as React.CSSProperties) : {}}>
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex">
        <div className={clsx("flex-shrink-0", gutter)}>
          {hours.map(h => (
            <div key={h} style={{ height: cellH }} className="border-b border-border/40 flex items-start justify-end pr-1.5 pt-1">
              <span className={clsx("text-muted-foreground", dense ? "text-[9px]" : "text-[10px]")}>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        {weekDays.map(date => {
          const dayEvents = events.filter(e => e.date === date);
          return (
            <div key={date} className="flex-1 min-w-0 relative border-l border-border/40"
              style={{ height: TOTAL_HOURS * cellH }}
              onDoubleClick={() => onDoubleClick(date)}>
              {hours.map(h => <div key={h} style={{ height: cellH }} className="border-b border-border/30" />)}
              {organizarColunas(dayEvents).map(item => {
                const ev = item.ev;
                return (
                <div key={eventKey(ev)}
                  onClick={e => { e.stopPropagation(); onSelectDate(date); onEventClick(ev); }}
                  title={`${CATEGORY_META[ev.category].shortName} · ${fmtTime(ev.time)}–${fmtTime(ev.endTime)} · ${statusLabel(ev.status)}`}
                  className="@container absolute rounded-md px-1.5 py-1 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ ...colunaStyle(item, 2), top: eventTop(ev, cellH), height: eventHeight(ev, cellH), background: ev.color }}>
                  <div className="flex items-center gap-1">
                    <StatusDot status={ev.status} size={12} />
                    <p className="text-[10px] text-white font-semibold leading-tight truncate">
                      {SHOW_EVENT_TITLE_IN_CHIP ? ev.title : fmtTime(ev.time)}
                    </p>
                    <span className="ml-auto hidden @min-[8rem]:inline text-[9px] text-white/90 whitespace-nowrap">
                      {statusLabel(ev.status)}
                    </span>
                  </div>
                  <p className="text-[9px] text-white/80">{fmtTime(ev.time)}–{fmtTime(ev.endTime)}</p>
                </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayView({ selectedDate, events, todayStr, color, dense, onDoubleClick, onEventClick }: {
  selectedDate: string; events: CalEvent[]; todayStr: string; color: string; dense?: boolean;
  onDoubleClick: (d: string) => void; onEventClick: (ev: CalEvent) => void;
}) {
  const d = new Date(selectedDate + "T12:00:00");
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);
  const dayEvents = events.filter(e => e.date === selectedDate);
  const cellH = dense ? CELL_H_DENSE : CELL_H;
  const gutter = dense ? "w-9" : "w-14";

  return (
    <div data-tour="cal-grade" className="flex-1 min-w-0 overflow-auto" style={{ scrollbarWidth: "none" }}>
      <div className={clsx("sticky top-0 bg-background z-10 border-b border-border flex items-center gap-3", dense ? "px-3 py-2" : "px-6 py-3")}>
        <span className="text-[10px] text-muted-foreground uppercase">{DAYS[d.getDay()]}</span>
        <span className={clsx("text-lg font-semibold w-9 h-9 flex items-center justify-center rounded-full",
          selectedDate === todayStr ? "text-white" : "text-foreground")}
          style={selectedDate === todayStr ? { background: color } : {}}>
          {d.getDate()}
        </span>
        <span className="text-sm text-muted-foreground truncate">{MONTHS[d.getMonth()]} {d.getFullYear()}</span>
      </div>
      <div className="flex">
        <div className={clsx("flex-shrink-0", gutter)}>
          {hours.map(h => (
            <div key={h} style={{ height: cellH }} className="border-b border-border/40 flex items-start justify-end pr-1.5 pt-1">
              <span className={clsx("text-muted-foreground", dense ? "text-[9px]" : "text-[10px]")}>{String(h).padStart(2, "0")}:00</span>
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0 relative border-l border-border/40" style={{ height: TOTAL_HOURS * cellH }}
          onDoubleClick={() => onDoubleClick(selectedDate)}>
          {hours.map(h => <div key={h} style={{ height: cellH }} className="border-b border-border/30" />)}
          {organizarColunas(dayEvents).map(item => {
            const ev = item.ev;
            return (
            <div key={eventKey(ev)}
              onClick={() => onEventClick(ev)}
              title={`${CATEGORY_META[ev.category].shortName} · ${fmtTime(ev.time)}–${fmtTime(ev.endTime)} · ${statusLabel(ev.status)}`}
              className="absolute rounded-xl px-3 py-2 cursor-pointer hover:opacity-90 transition-opacity shadow-sm overflow-hidden"
              style={{ ...colunaStyle(item, 4), top: eventTop(ev, cellH), height: eventHeight(ev, cellH), background: ev.color }}>
              <div className="flex items-center gap-1.5">
                <StatusDot status={ev.status} />
                <p className="text-xs text-white font-semibold leading-tight truncate">
                  {SHOW_EVENT_TITLE_IN_CHIP ? ev.title : fmtTime(ev.time)}
                </p>
                <span className="ml-auto text-[10px] text-white/90 whitespace-nowrap">{statusLabel(ev.status)}</span>
              </div>
              <p className="text-[10px] text-white/80 mt-0.5">{fmtTime(ev.time)}–{fmtTime(ev.endTime)}</p>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div data-tour="cal-busca" className="flex items-center gap-2 bg-sidebar-foreground/5 rounded-xl px-3 py-2">
      <Search size={12} className="text-sidebar-foreground/30 flex-shrink-0" />
      <input value={value} onChange={e => onChange(e.target.value)}
        placeholder="Buscar reservas…" aria-label="Buscar reservas"
        className="bg-transparent text-xs text-sidebar-foreground/70 placeholder-sidebar-foreground/25 outline-none flex-1 min-w-0" />
      {value && (
        <button onClick={() => onChange("")} aria-label="Limpar busca" className="text-sidebar-foreground/30 hover:text-sidebar-foreground/60 transition-colors flex-shrink-0">
          <X size={10} />
        </button>
      )}
    </div>
  );
}

function UpcomingList({ events, onSelect }: { events: CalEvent[]; onSelect: (d: string) => void }) {
  return (
    <div className="space-y-2">
      {events.length === 0 && (
        <p className="text-[11px] text-sidebar-foreground/25 italic">Nenhuma reserva futura</p>
      )}
      {events.map(ev => (
        <button key={eventKey(ev)} onClick={() => onSelect(ev.date)}
          title={`${CATEGORY_META[ev.category].shortName} · ${fmtTime(ev.time)}–${fmtTime(ev.endTime)} · ${statusLabel(ev.status)}`}
          className="w-full text-left flex items-start gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors group">
          <div className="w-0.5 min-h-8 rounded-full flex-shrink-0 mt-0.5" style={{ background: ev.color }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-sidebar-foreground/70 group-hover:text-sidebar-foreground/90 transition-colors truncate leading-tight">{ev.title}</p>
            <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">
              {fmtTime(ev.time)}–{fmtTime(ev.endTime)} · {new Date(ev.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </p>
          </div>
          <StatusDot status={ev.status} size={12} />
        </button>
      ))}
    </div>
  );
}

function CategoryFilterList({ filtros, colors, onToggle }: {
  filtros: CategoryKey[]; colors: Record<CategoryKey, string>; onToggle: (c: CategoryKey) => void;
}) {
  return (
    <div className="space-y-0.5">
      {ALL_CATEGORIES.map(c => {
        const meta = CATEGORY_META[c];
        const color = colors[c];
        const ativo = filtros.includes(c);
        return (
          <button key={c} onClick={() => onToggle(c)} role="checkbox" aria-checked={ativo} title={meta.name}
            className="w-full flex items-center gap-2.5 px-1 py-1.5 rounded-lg hover:bg-sidebar-accent transition-colors text-left">
            <span className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 border-2"
              style={{ borderColor: color, background: ativo ? color : "transparent" }}>
              {ativo && <Check size={9} strokeWidth={3} className="text-white" />}
            </span>
            <span className={clsx("text-xs truncate transition-colors", ativo ? "text-sidebar-foreground/80" : "text-sidebar-foreground/35")}>
              {meta.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CategoryFilterChips({ filtros, colors, onToggle }: {
  filtros: CategoryKey[]; colors: Record<CategoryKey, string>; onToggle: (c: CategoryKey) => void;
}) {
  return (
    <div data-tour="cal-filtros" className="flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {ALL_CATEGORIES.map(c => {
        const meta = CATEGORY_META[c];
        const Icon = meta.icon;
        const color = colors[c];
        const ativo = filtros.includes(c);
        return (
          <button key={c} onClick={() => onToggle(c)} aria-pressed={ativo}
            className={clsx("flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors",
              ativo ? "text-foreground" : "border-border text-muted-foreground")}
            style={ativo ? { borderColor: color, background: color + "20" } : {}}>
            <Icon size={12} style={{ color }} />
            {meta.shortName}
          </button>
        );
      })}
    </div>
  );
}

function DayPanel({ selectedDate, events, selectedKey, loading, loadError, onEventClick, onRetry, onAdd }: {
  selectedDate: string; events: CalEvent[]; selectedKey: string | null;
  loading: boolean; loadError: string | null;
  onEventClick: (ev: CalEvent) => void; onRetry: () => void; onAdd: () => void;
}) {
  return (
    <>
      <div className="mb-5">
        <p className="text-xs text-muted-foreground mb-0.5 capitalize">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" })}
        </p>
        <h2 style={{ fontFamily: "'Blinker', sans-serif" }} className="text-1xl text-foreground">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
        </h2>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-11 h-11 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Calendar size={18} className="text-muted-foreground" />
          </div>
          {loading ? (
            <>
              <p className="text-sm text-muted-foreground">Carregando…</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Buscando reservas do servidor</p>
            </>
          ) : loadError ? (
            <>
              <p className="text-sm text-muted-foreground">Erro ao carregar</p>
              <button onClick={onRetry} className="text-xs text-[#5b4fcf] mt-1 hover:underline">Tentar de novo</button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Nenhuma reserva</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Toque em "Adicionar reserva" para criar</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={eventKey(ev)}
              onClick={() => onEventClick(ev)}
              className={clsx("bg-card rounded-2xl p-4 shadow-sm border transition-all cursor-pointer",
                eventKey(ev) === selectedKey
                  ? "border-[#5b4fcf]/40 ring-2 ring-[#5b4fcf]/15 shadow-md"
                  : "border-border/50 hover:border-border hover:shadow"
              )}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ev.color }} />
                <StatusBadge status={ev.status} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2 leading-snug">{ev.title}</h3>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock size={11} /><span>{fmtTime(ev.time)} – {fmtTime(ev.endTime)}</span>
                </div>
                {ev.location && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={11} /><span>{ev.location}</span>
                  </div>
                )}
                {!!ev.attendees && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users size={11} />
                    <span>{ev.attendees} {ev.category === "FLEET_VEHICLE" ? "passageiros" : "participantes"}</span>
                  </div>
                )}
                {ev.responsavel && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Tag size={11} /><span>{ev.responsavel}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={onAdd}
        className="w-full mt-4 flex items-center justify-center gap-2 border border-dashed border-border rounded-2xl py-3 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
        <Plus size={12} /> Adicionar reserva
      </button>
    </>
  );
}

export default function CategoryCalendar() {
  const location = useLocation();
  const { calendarEvents, loadCalendarMonth, calendarStatusFor, calendarErrorFor } = useEvents();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<CategoryKey[]>(() => filtroInicial(location.state));
  const { colors } = useCategoryColors();
  const tutorial = useTutorial();
  const tutorialStep = tutorial.step;

  const today = new Date();
  const todayStr = toDateStr(today);

  const [view, setView]                 = useState<"Mês" | "Semana" | "Dia">("Mês");
  const [currentYear, setCurrentYear]   = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [miniYear, setMiniYear]         = useState(today.getFullYear());
  const [miniMonth, setMiniMonth]       = useState(today.getMonth());
  const [modalDate, setModalDate]       = useState<string | null>(null);
  const [detailKey, setDetailKey]       = useState<string | null>(null);
  const [rawSearch, setRawSearch]       = useState("");
  const [searchQuery, setSearchQuery]   = useState("");

  const breakpoint = useBreakpoint();
  const [leftOpen, setLeftOpen]   = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const selectDate = useCallback((date: string) => {
    setSelectedDate(date);
    setSelectedKey(null);
    const d = new Date(date + "T12:00:00");
    setCurrentYear(d.getFullYear());
    setCurrentMonth(d.getMonth());
    setMiniYear(d.getFullYear());
    setMiniMonth(d.getMonth());
  }, []);

  const onEventClick = useCallback((ev: CalEvent) => {
    selectDate(ev.date);
    setSelectedKey(eventKey(ev));
    setDetailKey(eventKey(ev));
  }, [selectDate]);

  const toggleFiltro = (c: CategoryKey) => {
    if (filtros.includes(c)) setFiltros(filtros.filter(f => f !== c));
    else setFiltros([...filtros, c]);
  };

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(rawSearch.toLowerCase().trim()), 280);
    return () => clearTimeout(t);
  }, [rawSearch]);

  useEffect(() => {
    if (breakpoint === "desktop") {
      setLeftOpen(true);
      setRightOpen(true);
    }
  }, [breakpoint]);

  useEffect(() => {
    if (!tutorialStep) return;
    setLeftOpen(true);
    setRightOpen(true);
    setDetailKey(null);
    if (!tutorialStep.modal) {
      setModalDate(null);
      return;
    }
    setModalDate(atual => {
      if (atual) return atual;
      return selectedDate;
    });
  }, [tutorialStep]);

  const visibleMonths = useMemo(() => {
    const list: { year: number; month: number }[] = [];
    const add = (year: number, month: number) => {
      const exists = list.some(m => m.year === year && m.month === month);
      if (!exists) list.push({ year, month });
    };
    if (view === "Mês") {
      add(currentYear, currentMonth);
    } else if (view === "Dia") {
      const d = new Date(selectedDate + "T12:00:00");
      add(d.getFullYear(), d.getMonth());
    } else {
      const d = new Date(selectedDate + "T12:00:00");
      const sun = new Date(d);
      sun.setDate(d.getDate() - d.getDay());
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      add(sun.getFullYear(), sun.getMonth());
      add(sat.getFullYear(), sat.getMonth());
    }
    add(miniYear, miniMonth);
    return list;
  }, [view, currentYear, currentMonth, selectedDate, miniYear, miniMonth]);

  useEffect(() => {
    visibleMonths.forEach(({ year, month }) => loadCalendarMonth(year, month + 1));
  }, [visibleMonths, loadCalendarMonth]);

  const allEvents = calendarEvents.map(ev => ({ ...ev, color: colors[ev.category] ?? CATEGORY_META[ev.category].color }));
  const events = allEvents.filter(ev => filtros.includes(ev.category));

  let detailEvent: CalEvent | null = null;
  if (detailKey) detailEvent = allEvents.find(ev => eventKey(ev) === detailKey) ?? null;

  const loading = visibleMonths.some(({ year, month }) => calendarStatusFor(year, month + 1) === "loading");
  const loadError = visibleMonths.map(({ year, month }) => calendarErrorFor(year, month + 1)).find(Boolean) ?? null;

  const filteredEvents = searchQuery
    ? events.filter(ev => [ev.title, ev.date, ev.responsavel ?? "", CATEGORY_META[ev.category].name].join(" ").toLowerCase().includes(searchQuery))
    : events;

  const selectedEvents = filteredEvents.filter(e => e.date === selectedDate);
  const upcomingEvents = events.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentYear(y => y - 1);
      setCurrentMonth(11);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentYear(y => y + 1);
      setCurrentMonth(0);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const moveSelectedDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    selectDate(toDateStr(d));
  };

  const handlePrev = () => {
    if (view === "Mês") prevMonth();
    else if (view === "Semana") moveSelectedDate(-7);
    else moveSelectedDate(-1);
  };

  const handleNext = () => {
    if (view === "Mês") nextMonth();
    else if (view === "Semana") moveSelectedDate(7);
    else moveSelectedDate(1);
  };

  const getHeaderLabel = () => {
    if (view === "Mês") return `${MONTHS[currentMonth]} ${currentYear}`;
    if (view === "Semana") {
      const d = new Date(selectedDate + "T12:00:00");
      const sun = new Date(d);
      sun.setDate(d.getDate() - d.getDay());
      const sat = new Date(sun);
      sat.setDate(sun.getDate() + 6);
      return `${sun.getDate()} – ${sat.getDate()} de ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
    }
    const d = new Date(selectedDate + "T12:00:00");
    return `${d.getDate()} de ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const headerLabel = getHeaderLabel();

  const openModal = (date: string) => {
    setSelectedDate(date);
    setModalDate(date);
  };

  const reloadVisibleMonths = () => {
    visibleMonths.forEach(({ year, month }) => loadCalendarMonth(year, month + 1, true));
  };

  let categoriaInicial: CategoryKey | null = null;
  if (filtros.length === 1) categoriaInicial = filtros[0];

  const isMobile = breakpoint === "mobile";
  const isTablet = breakpoint === "tablet";

  const goToday = () => {
    selectDate(todayStr);
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const modals = (
    <>
      {modalDate && (
        <EventModal date={modalDate} initialCategory={categoriaInicial} events={allEvents}
          onClose={() => setModalDate(null)}
          onSave={reservationDate => {
            const d = new Date(reservationDate + "T12:00:00");
            loadCalendarMonth(d.getFullYear(), d.getMonth() + 1, true);
          }} />
      )}

      {detailEvent && (
        <EventDetailsModal event={detailEvent} onClose={() => setDetailKey(null)} />
      )}
    </>
  );

  const dayPanel = (
    <DayPanel selectedDate={selectedDate} events={selectedEvents} selectedKey={selectedKey}
      loading={loading} loadError={loadError}
      onEventClick={onEventClick} onRetry={reloadVisibleMonths} onAdd={() => openModal(selectedDate)} />
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background">
        {modals}

        <div className="flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND_COLOR + "30" }}>
            <Calendar size={13} style={{ color: BRAND_COLOR }} />
          </div>
          <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">Calendário</span>
          <button onClick={goToday}
            className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            Hoje
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ scrollbarWidth: "none" }}>
          <button data-tour="cal-nova-reserva" onClick={() => openModal(selectedDate)}
            className="w-full flex items-center justify-center gap-2 text-white text-sm font-medium py-3 rounded-xl transition-colors hover:opacity-90"
            style={{ background: BRAND_COLOR }}>
            <Plus size={15} /> Nova reserva
          </button>

          <SearchField value={rawSearch} onChange={setRawSearch} />

          <CategoryFilterChips filtros={filtros} colors={colors} onToggle={toggleFiltro} />

          {searchQuery && (
            <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-2">
              <Search size={11} className="text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {filteredEvents.length} resultado{filteredEvents.length !== 1 ? "s" : ""} para <strong>"{rawSearch}"</strong>
              </span>
              <button onClick={() => setRawSearch("")} className="ml-auto text-[11px] text-[#5b4fcf] flex-shrink-0">Limpar</button>
            </div>
          )}

          {loadError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 px-3 py-2">
              <span className="text-xs text-red-500 flex-1 min-w-0">Erro ao carregar reservas: {loadError}</span>
              <button onClick={reloadVisibleMonths} className="text-[11px] text-[#5b4fcf] flex-shrink-0">Tentar de novo</button>
            </div>
          )}

          {loading && !loadError && (
            <div className="rounded-xl bg-muted/40 px-3 py-2">
              <span className="text-xs text-muted-foreground">Carregando reservas…</span>
            </div>
          )}

          <div data-tour="cal-mini" className="rounded-2xl border border-sidebar-border bg-sidebar p-4">
            <MiniCalendar large year={miniYear} month={miniMonth} selectedDate={selectedDate} events={events}
              onSelect={selectDate} onMonthChange={(y, m) => { setMiniYear(y); setMiniMonth(m); }} />
          </div>

          <div data-tour="cal-dia" aria-busy={loading}>
            {dayPanel}
          </div>

          <div data-tour="cal-proximas" className="rounded-2xl border border-sidebar-border bg-sidebar p-4">
            <p className="text-[10px] text-sidebar-foreground/25 uppercase tracking-widest font-medium mb-3">Próximas reservas</p>
            <UpcomingList events={upcomingEvents} onSelect={selectDate} />
          </div>

          {tutorial.active && <div className="h-[45dvh]" aria-hidden="true" />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {modals}

      {leftOpen && (
        <aside className={clsx("flex-shrink-0 flex flex-col border-r border-sidebar-border overflow-hidden bg-sidebar",
          isTablet ? "w-48" : "w-60")}>
          <div className={clsx("pt-5 pb-4", isTablet ? "px-3" : "px-4")}>
            <div className="flex items-center gap-2 mb-5 px-1">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND_COLOR + "30" }}>
                <Calendar size={12} style={{ color: BRAND_COLOR }} />
              </div>
              <span className="text-sidebar-foreground/80 text-xs font-medium leading-tight">Calendário</span>
            </div>

            <button data-tour="cal-nova-reserva" onClick={() => openModal(selectedDate)}
              className="w-full flex items-center justify-center gap-2 text-white text-xs font-medium py-2.5 rounded-xl transition-colors hover:opacity-90"
              style={{ background: BRAND_COLOR }}>
              <Plus size={14} /> Nova reserva
            </button>
          </div>

          <div className={clsx("mb-4", isTablet ? "px-3" : "px-4")}>
            <SearchField value={rawSearch} onChange={setRawSearch} />
          </div>

          <div data-tour="cal-mini" className={clsx("mb-4", isTablet ? "px-3" : "px-4")}>
            <MiniCalendar year={miniYear} month={miniMonth} selectedDate={selectedDate} events={events}
              onSelect={selectDate} onMonthChange={(y, m) => { setMiniYear(y); setMiniMonth(m); }} />
          </div>

          <div data-tour="cal-filtros" className={clsx("mb-4", isTablet ? "px-3" : "px-4")}>
            <p className="text-[10px] text-sidebar-foreground/25 uppercase tracking-widest font-medium mb-2">Categorias</p>
            <CategoryFilterList filtros={filtros} colors={colors} onToggle={toggleFiltro} />
          </div>

          <div className={clsx("border-t border-sidebar-border mb-4", isTablet ? "mx-3" : "mx-4")} />

          <div data-tour="cal-proximas" className={clsx("flex-1 overflow-hidden", isTablet ? "px-3" : "px-4")}>
            <p className="text-[10px] text-sidebar-foreground/25 uppercase tracking-widest font-medium mb-3">Próximas reservas</p>
            <div className="overflow-y-auto" style={{ maxHeight: "calc(100% - 24px)", scrollbarWidth: "none" }}>
              <UpcomingList events={upcomingEvents} onSelect={selectDate} />
            </div>
          </div>
        </aside>
      )}

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
        <div className={clsx("flex items-center justify-between gap-2 border-b border-border flex-shrink-0",
          isTablet ? "px-3 py-3" : "px-6 py-4")}>
          <div className={clsx("flex items-center min-w-0", isTablet ? "gap-2" : "gap-3")}>
            {isTablet && (
              <button onClick={() => setLeftOpen(v => !v)}
                aria-label={leftOpen ? "Ocultar painel esquerdo" : "Mostrar painel esquerdo"}
                title={leftOpen ? "Ocultar painel esquerdo" : "Mostrar painel esquerdo"}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                {leftOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
              </button>
            )}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={handlePrev} aria-label="Anterior" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><ChevronLeft size={15} /></button>
              <button onClick={handleNext} aria-label="Próximo"  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><ChevronRight size={15} /></button>
            </div>
            <h1 style={{ fontFamily: "'Blinker', sans-serif" }} className={clsx("text-foreground truncate", isTablet ? "text-base" : "text-xl")}>{headerLabel}</h1>
            <button onClick={goToday}
              className="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors flex-shrink-0">
              Hoje
            </button>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div data-tour="cal-visao" className="flex rounded-xl border border-border overflow-hidden text-xs">
              {(["Mês", "Semana", "Dia"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} aria-pressed={v === view}
                  className={clsx("transition-colors", isTablet ? "px-2 py-1.5" : "px-3 py-1.5",
                    v === view ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                  {v}
                </button>
              ))}
            </div>
            {isTablet && (
              <button onClick={() => setRightOpen(v => !v)}
                aria-label={rightOpen ? "Ocultar painel do dia" : "Mostrar painel do dia"}
                title={rightOpen ? "Ocultar painel do dia" : "Mostrar painel do dia"}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                {rightOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
              </button>
            )}
          </div>
        </div>

        {searchQuery && (
          <div className={clsx("py-2 border-b border-border bg-muted/30 flex items-center gap-2", isTablet ? "px-3" : "px-6")}>
            <Search size={11} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {filteredEvents.length} resultado{filteredEvents.length !== 1 ? "s" : ""} para <strong>"{rawSearch}"</strong>
            </span>
            <button onClick={() => setRawSearch("")} className="ml-auto text-[11px] text-[#5b4fcf] hover:underline flex-shrink-0">Limpar</button>
          </div>
        )}

        {loadError && (
          <div className={clsx("py-2 border-b border-border bg-red-50 dark:bg-red-950/30 flex items-center gap-2", isTablet ? "px-3" : "px-6")}>
            <span className="text-xs text-red-500">Erro ao carregar reservas: {loadError}</span>
            <button onClick={reloadVisibleMonths} className="ml-auto text-[11px] text-[#5b4fcf] hover:underline flex-shrink-0">Tentar de novo</button>
          </div>
        )}
        {loading && !loadError && (
          <div className={clsx("py-2 border-b border-border bg-muted/30 flex items-center gap-2", isTablet ? "px-3" : "px-6")}>
            <span className="text-xs text-muted-foreground">Carregando reservas…</span>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {view === "Mês"    && <MonthView year={currentYear} month={currentMonth} selectedDate={selectedDate} events={filteredEvents} todayStr={todayStr} color={BRAND_COLOR} dense={isTablet} onSelectDate={selectDate} onDoubleClick={openModal} onEventClick={onEventClick} />}
          {view === "Semana" && <WeekView  selectedDate={selectedDate} events={filteredEvents} todayStr={todayStr} color={BRAND_COLOR} dense={isTablet} onSelectDate={selectDate} onDoubleClick={openModal} onEventClick={onEventClick} />}
          {view === "Dia"    && <DayView   selectedDate={selectedDate} events={filteredEvents} todayStr={todayStr} color={BRAND_COLOR} dense={isTablet} onDoubleClick={openModal} onEventClick={onEventClick} />}

          {rightOpen && (
            <div data-tour="cal-dia" aria-busy={loading} className={clsx("flex-shrink-0 border-l border-border overflow-y-auto", isTablet ? "w-[216px] p-4" : "w-[272px] p-5")}
              style={{ scrollbarWidth: "none" }}>
              {dayPanel}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
