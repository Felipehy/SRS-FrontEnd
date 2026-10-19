import { AlertCircle, CheckCircle, XCircle, Check, Clock, X, Minus, Coffee } from "lucide-react";
import { clsx } from "clsx";
import type { CalEvent, ReservationStatus } from "../types/calendar";

const STATUS_CONFIG: Record<ReservationStatus, { label: string; icon: React.ElementType; cls: string }> = {
  ENVIADA_PARA_ANALISE: { label: "Pendente",   icon: AlertCircle, cls: "text-amber-600  bg-amber-50  dark:bg-amber-950/30  border-amber-200  dark:border-amber-800" },
  APROVADA:             { label: "Aprovada",   icon: CheckCircle, cls: "text-green-600  bg-green-50  dark:bg-green-950/30  border-green-200  dark:border-green-800" },
  REPROVADA:            { label: "Reprovada",  icon: XCircle,     cls: "text-red-600    bg-red-50    dark:bg-red-950/30    border-red-200    dark:border-red-800"   },
  FINALIZADA:           { label: "Finalizada", icon: CheckCircle, cls: "text-blue-600   bg-blue-50   dark:bg-blue-950/30   border-blue-200   dark:border-blue-800"  },
  CANCELADA:            { label: "Cancelada",  icon: XCircle,     cls: "text-slate-500  bg-slate-50  dark:bg-slate-900/50  border-slate-200  dark:border-slate-700" },
};

const STATUS_MARK: Record<ReservationStatus, { label: string; icon: React.ElementType; color: string }> = {
  ENVIADA_PARA_ANALISE: { label: "Em análise", icon: Clock, color: "#f59e0b" },
  APROVADA:             { label: "Aprovada",   icon: Check, color: "#16a34a" },
  REPROVADA:            { label: "Reprovada",  icon: X,     color: "#dc2626" },
  FINALIZADA:           { label: "Finalizada", icon: Check, color: "#2563eb" },
  CANCELADA:            { label: "Cancelada",  icon: Minus, color: "#64748b" },
};

export function statusLabel(status: ReservationStatus): string {
  return STATUS_MARK[status].label;
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border", cfg.cls)}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

export function StatusDot({ status, size = 14 }: { status: ReservationStatus; size?: number }) {
  const cfg = STATUS_MARK[status];
  const Icon = cfg.icon;
  return (
    <span
      title={cfg.label}
      aria-label={cfg.label}
      className="inline-flex items-center justify-center rounded-full bg-white shadow-sm flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <Icon size={size - 5} strokeWidth={3.5} style={{ color: cfg.color }} />
    </span>
  );
}

export type CoffeeState = "sem-cafe" | "pendente" | "aprovado" | "recusado";

const COFFEE_CONFIG: Record<CoffeeState, { label: string; cls: string }> = {
  "sem-cafe": { label: "Sem café",       cls: "text-muted-foreground bg-muted border-border" },
  pendente:   { label: "Café pendente",  cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
  aprovado:   { label: "Café aprovado",  cls: "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  recusado:   { label: "Café recusado",  cls: "text-red-600   bg-red-50   dark:bg-red-950/30   border-red-200   dark:border-red-800"   },
};

export function coffeeState(ev: Pick<CalEvent, "cafe" | "cafeAprovado">): CoffeeState {
  if (!ev.cafe) return "sem-cafe";
  if (ev.cafeAprovado === true) return "aprovado";
  if (ev.cafeAprovado === false) return "recusado";
  return "pendente";
}

export function coffeeDecidable(ev: CalEvent): boolean {
  if (coffeeState(ev) === "sem-cafe") return false;
  if (ev.status === "REPROVADA") return false;
  if (ev.status === "CANCELADA") return false;
  return true;
}

export function coffeePending(ev: CalEvent): boolean {
  if (!coffeeDecidable(ev)) return false;
  return coffeeState(ev) === "pendente";
}

export function coffeeLabel(state: CoffeeState): string {
  return COFFEE_CONFIG[state].label;
}

export function CoffeeBadge({ state }: { state: CoffeeState }) {
  const cfg = COFFEE_CONFIG[state];
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border", cfg.cls)}>
      <Coffee size={10} />
      {cfg.label}
    </span>
  );
}
