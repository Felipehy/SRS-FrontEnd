import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search, X, Calendar, Clock, MapPin, User, Building2,
  Filter, Check, CheckCircle, XCircle, AlertCircle, ChevronRight, RefreshCw, Coffee, Ban,
} from "lucide-react";
import { clsx } from "clsx";
import { useEvents } from "../context/EventsContext";
import { useAuth } from "../context/AuthContext";
import { canCancelReservation } from "../auth/permissions";
import { useCategoryColors } from "../context/CategoryColorsContext";
import { StatusBadge, CoffeeBadge, coffeeState, coffeePending, coffeeDecidable } from "../components/StatusBadge";
import { ReservationDetails } from "../components/ReservationDetails";
import type { CalEvent, CategoryKey, ReservationStatus } from "../types/calendar";

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  MEETING_ROOM:  "Salas de Reunião",
  AUDITORIUM:    "Auditório",
  FLEET_VEHICLE: "Veículos Oficiais da Frota",
};

const ALL_CATEGORIES: CategoryKey[] = ["MEETING_ROOM", "AUDITORIUM", "FLEET_VEHICLE"];

const MAX_MOTIVO_RECUSA_CAFE = 300;

function needsAction(ev: CalEvent): boolean {
  if (ev.status === "ENVIADA_PARA_ANALISE") return true;
  return coffeePending(ev);
}

function groupByDate(list: CalEvent[]): Record<string, CalEvent[]> {
  const out: Record<string, CalEvent[]> = {};
  for (const ev of list) {
    if (!out[ev.date]) out[ev.date] = [];
    out[ev.date].push(ev);
  }
  return out;
}

function formatDisplayDate(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function ActionError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
      <AlertCircle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
      <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{message}</p>
    </div>
  );
}

function ActionModal({
  event,
  onClose,
  onApprove,
  onReject,
  onCancel,
  onApproveCoffee,
  onRejectCoffee,
}: {
  event: CalEvent;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onReject: (motivo: string) => Promise<void>;
  onCancel: (motivo: string) => Promise<void>;
  onApproveCoffee: () => Promise<void>;
  onRejectCoffee: (motivo: string) => Promise<void>;
}) {
  const { refreshEvent } = useEvents();
  const { user } = useAuth();
  const [mode, setMode] = useState<"detail" | "reject" | "reject-cafe" | "cancel">("detail");
  const [motivo, setMotivo] = useState("");
  const [motivoError, setMotivoError] = useState("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [motivoCancelamentoError, setMotivoCancelamentoError] = useState("");
  const [motivoCafe, setMotivoCafe] = useState("");
  const [motivoCafeError, setMotivoCafeError] = useState("");
  const [cafeDecidido, setCafeDecidido] = useState<"aprovado" | "recusado" | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

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
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose, busy]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError("");
    try {
      await action();
      onClose();
    } catch (err: any) {
      setActionError(err?.detail ?? err?.message ?? "Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const runKeepOpen = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError("");
    try {
      await action();
      setMode("detail");
    } catch (err: any) {
      setActionError(err?.detail ?? err?.message ?? "Não foi possível concluir a ação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  };

  const handleRejectConfirm = () => {
    if (!motivo.trim()) {
      setMotivoError("O motivo é obrigatório.");
      return;
    }
    run(() => onReject(motivo.trim()));
  };

  const handleCancelConfirm = () => {
    if (!motivoCancelamento.trim()) {
      setMotivoCancelamentoError("O motivo do cancelamento é obrigatório.");
      return;
    }
    run(() => onCancel(motivoCancelamento.trim()));
  };

  const handleRejectCoffeeConfirm = () => {
    const motivo = motivoCafe.trim();
    if (!motivo) {
      setMotivoCafeError("O motivo da recusa é obrigatório.");
      return;
    }
    runKeepOpen(async () => {
      await onRejectCoffee(motivo);
      setMotivoCafe("");
      setCafeDecidido("recusado");
    });
  };

  const handleApproveCoffee = () => {
    runKeepOpen(async () => {
      await onApproveCoffee();
      setCafeDecidido("aprovado");
    });
  };

  const catLabel = CATEGORY_LABELS[event.category];
  const isPending = event.status === "ENVIADA_PARA_ANALISE";
  const podeCancelar = event.status === "APROVADA" && canCancelReservation(user, event);
  const cafeState = coffeeState(event);
  const cafeDecidivel = coffeeDecidable(event);

  const coffeeActions = cafeDecidivel ? (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleApproveCoffee}
          disabled={busy || syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 text-[11px] font-medium hover:bg-green-100 dark:hover:bg-green-950/60 transition-colors disabled:opacity-60 disabled:cursor-default"
        >
          <Coffee size={12} /> {busy ? "Salvando…" : "Aprovar café"}
        </button>
        <button
          onClick={() => setMode("reject-cafe")}
          disabled={busy || syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-[11px] font-medium hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors disabled:opacity-60 disabled:cursor-default"
        >
          <Coffee size={12} /> Recusar café
        </button>
      </div>
      {cafeDecidido && (
        <p className={clsx(
          "text-[11px] font-medium",
          cafeDecidido === "aprovado" ? "text-green-600" : "text-red-600",
        )}>
          {cafeDecidido === "aprovado" ? "Café aprovado com sucesso." : "Café recusado com sucesso."}
        </p>
      )}
      {cafeState !== "pendente" && (
        <p className="text-[10px] text-muted-foreground">
          A decisão do café pode ser alterada a qualquer momento.
        </p>
      )}
    </div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        style={{ animation: "modalIn 0.18s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="px-6 pt-6 pb-4 border-b border-border flex items-start justify-between flex-shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: event.color }} />
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{catLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground mb-1">{formatDisplayDate(event.date)}</p>
            {event.responsavel && (
              <p className="text-xs text-muted-foreground mb-1 break-words">
                Solicitado por {event.responsavel}
                {event.departamento ? ` · ${event.departamento}` : ""}
              </p>
            )}
            <h2 style={{ fontFamily: "'Google Sans', sans-serif" }} className="text-xl text-foreground leading-snug break-words">
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors mt-0.5 flex-shrink-0">
            <X size={15} />
          </button>
        </div>

        {mode === "detail" && (
          <>
            <div className="px-6 py-5 space-y-3 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {syncError && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-500 font-semibold mb-0.5">
                    Dados podem estar desatualizados
                  </p>
                  <p className="text-xs text-amber-800 dark:text-amber-300 break-words">{syncError}</p>
                </div>
              )}

              {event.status === "REPROVADA" && event.motivoReprova && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-600 mb-1">Motivo da reprovação</p>
                  <p className="text-xs text-red-700 dark:text-red-400">{event.motivoReprova}</p>
                </div>
              )}

              <ReservationDetails event={event} coffeeActions={coffeeActions} />
            </div>

            <div className="px-6 py-4 border-t border-border space-y-3 flex-shrink-0">
              {actionError && <ActionError message={actionError} />}

              {isPending && (
                <div className="flex gap-2">
                  <button
                    onClick={() => run(onApprove)}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-default"
                  >
                    <CheckCircle size={14} /> {busy ? "Aprovando…" : "Aprovar"}
                  </button>
                  <button
                    onClick={() => setMode("reject")}
                    disabled={busy}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-default"
                  >
                    <XCircle size={14} /> Reprovar
                  </button>
                </div>
              )}

              {podeCancelar && (
                <button onClick={() => setMode("cancel")} disabled={busy}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors disabled:opacity-60 disabled:cursor-default">
                  <Ban size={14} /> Cancelar reserva
                </button>
              )}

              {!isPending && (
                <button onClick={onClose}
                  className="w-full py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Fechar
                </button>
              )}
            </div>
          </>
        )}

        {mode === "reject" && (
          <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Motivo da reprovação</p>
              <p className="text-xs text-muted-foreground mb-3">
                Informe o motivo para que o solicitante seja notificado.
              </p>
              <textarea
                autoFocus
                value={motivo}
                onChange={e => { setMotivo(e.target.value); setMotivoError(""); }}
                rows={4}
                placeholder="Descreva o motivo da reprovação…"
                className={clsx(
                  "w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none resize-none transition-all placeholder-muted-foreground/50",
                  motivoError ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-transparent focus:border-[#5b4fcf]/30 focus:bg-card"
                )}
              />
              {motivoError && <p className="text-[11px] text-red-500 mt-1">{motivoError}</p>}
            </div>

            {actionError && <ActionError message={actionError} />}

            <div className="flex gap-2">
              <button onClick={() => setMode("detail")} disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60 disabled:cursor-default">
                Voltar
              </button>
              <button onClick={handleRejectConfirm} disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-default">
                <XCircle size={14} /> {busy ? "Reprovando…" : "Confirmar reprovação"}
              </button>
            </div>
          </div>
        )}

        {mode === "cancel" && (
          <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Cancelar esta reserva?</p>
              <p className="text-xs text-muted-foreground mb-3">
                A reserva passa para o status "Cancelada" e o horário volta a ficar livre.
                Esta ação não pode ser desfeita.
              </p>
              <textarea
                autoFocus
                value={motivoCancelamento}
                onChange={e => { setMotivoCancelamento(e.target.value); setMotivoCancelamentoError(""); }}
                rows={4}
                placeholder="Descreva o motivo do cancelamento…"
                className={clsx(
                  "w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none resize-none transition-all placeholder-muted-foreground/50",
                  motivoCancelamentoError ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-transparent focus:border-[#5b4fcf]/30 focus:bg-card"
                )}
              />
              {motivoCancelamentoError && <p className="text-[11px] text-red-500 mt-1">{motivoCancelamentoError}</p>}
            </div>

            {actionError && <ActionError message={actionError} />}

            <div className="flex gap-2">
              <button onClick={() => setMode("detail")} disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60 disabled:cursor-default">
                Voltar
              </button>
              <button onClick={handleCancelConfirm} disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-default">
                <Ban size={14} /> {busy ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
            </div>
          </div>
        )}

        {mode === "reject-cafe" && (
          <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Motivo da recusa do café</p>
              <p className="text-xs text-muted-foreground mb-3">
                A reserva continua com o status atual — apenas o café é recusado.
              </p>
              <textarea
                autoFocus
                value={motivoCafe}
                maxLength={MAX_MOTIVO_RECUSA_CAFE}
                onChange={e => { setMotivoCafe(e.target.value); setMotivoCafeError(""); }}
                rows={4}
                placeholder="Descreva o motivo da recusa do café…"
                className={clsx(
                  "w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none resize-none transition-all placeholder-muted-foreground/50",
                  motivoCafeError ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-transparent focus:border-[#5b4fcf]/30 focus:bg-card"
                )}
              />
              <div className="flex justify-between items-start gap-2 mt-1">
                {motivoCafeError && <p className="text-[11px] text-red-500">{motivoCafeError}</p>}
                <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">
                  {motivoCafe.length}/{MAX_MOTIVO_RECUSA_CAFE}
                </span>
              </div>
            </div>

            {actionError && <ActionError message={actionError} />}

            <div className="flex gap-2">
              <button onClick={() => setMode("detail")} disabled={busy}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60 disabled:cursor-default">
                Voltar
              </button>
              <button onClick={handleRejectCoffeeConfirm} disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-default">
                <XCircle size={14} /> {busy ? "Recusando…" : "Confirmar recusa"}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

function EventRow({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const cafeState = coffeeState(ev);
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-4 p-4 bg-card rounded-2xl border border-border/50 hover:border-border hover:shadow-sm transition-all group"
    >
      <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: ev.color }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-1">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-snug truncate">{ev.title}</p>
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{CATEGORY_LABELS[ev.category]}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <StatusBadge status={ev.status} />
            {cafeState !== "sem-cafe" && <CoffeeBadge state={cafeState} />}
            <ChevronRight size={13} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar size={10} /> {formatDisplayDate(ev.date)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock size={10} /> {ev.time} – {ev.endTime}
          </span>
          {ev.location && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin size={10} /> {ev.location}
            </span>
          )}
          {ev.responsavel && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User size={10} /> {ev.responsavel}
            </span>
          )}
          {ev.departamento && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 size={10} /> {ev.departamento}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function AdministracaoPage() {
  const { allEvents, approveEvent, rejectEvent, cancelEvent, approveCoffee, rejectCoffee, loadMonth, loadAll, statusFor, errorFor, statusForAll, errorForAll } = useEvents();
  const { colors } = useCategoryColors();

  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [rawSearch, setRawSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<CategoryKey | "todas">("todas");
  const [filterStatus, setFilterStatus] = useState<ReservationStatus | "todas">("ENVIADA_PARA_ANALISE");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const optionYear = new Date().getFullYear();

  useEffect(() => {
    if (!filterOpen) return;
    const onClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const loadCurrent = useCallback((force = false) => {
    if (!filterMonth) {
      ALL_CATEGORIES.forEach(c => loadAll(c, force));
      return;
    }
    const [year, month] = filterMonth.split("-").map(Number);
    ALL_CATEGORIES.forEach(c => loadMonth(c, year, month, force));
  }, [filterMonth, loadMonth, loadAll]);

  useEffect(() => { loadCurrent(); }, [loadCurrent]);

  const [selYear, selMonth] = filterMonth ? filterMonth.split("-").map(Number) : [0, 0];
  const scopedStatus = (c: CategoryKey) => (filterMonth ? statusFor(c, selYear, selMonth) : statusForAll(c));
  const scopedError = (c: CategoryKey) => (filterMonth ? errorFor(c, selYear, selMonth) : errorForAll(c));
  const loading = ALL_CATEGORIES.some(c => scopedStatus(c) === "loading");
  const loadError = ALL_CATEGORIES.map(scopedError).find(Boolean) ?? null;

  const coloredEvents = allEvents.map(ev => ({ ...ev, color: colors[ev.category] }));

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(rawSearch.toLowerCase().trim()), 280);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const filtered = coloredEvents.filter(ev => {
    if (filterCategory !== "todas" && ev.category !== filterCategory) return false;
    if (filterStatus !== "todas" && ev.status !== filterStatus) return false;
    if (filterMonth && !ev.date.startsWith(filterMonth)) return false;
    if (searchQuery) {
      const hay = [ev.title, ev.date, ev.responsavel ?? "", ev.departamento ?? "", CATEGORY_LABELS[ev.category]].join(" ").toLowerCase();
      if (!hay.includes(searchQuery)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const pendentes = sorted.filter(needsAction);
  const demais = sorted.filter(ev => !needsAction(ev));
  const grouped = groupByDate(demais);

  const activeFilterCount =
    (filterCategory !== "todas" ? 1 : 0) +
    (filterStatus !== "todas" ? 1 : 0) +
    (filterMonth ? 1 : 0);

  const monthEvents = allEvents.filter(ev => ev.date.startsWith(filterMonth));
  const counts = {
    total: monthEvents.length,
    pendente: monthEvents.filter(e => e.status === "ENVIADA_PARA_ANALISE").length,
    cafePendente: monthEvents.filter(coffeePending).length,
  };

  useEffect(() => {
    if (!selectedEvent) return;
    const updated = allEvents.find(e => e.id === selectedEvent.id && e.category === selectedEvent.category);
    if (updated) setSelectedEvent({ ...updated, color: colors[updated.category] });
  }, [allEvents, colors]);

  return (
    <div className="h-full overflow-auto bg-background" style={{ scrollbarWidth: "none" }}>
      {selectedEvent && (
        <ActionModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onApprove={() => approveEvent(selectedEvent.id, selectedEvent.category)}
          onReject={motivo => rejectEvent(selectedEvent.id, selectedEvent.category, motivo)}
          onCancel={motivo => cancelEvent(selectedEvent.id, selectedEvent.category, motivo)}
          onApproveCoffee={() => approveCoffee(selectedEvent.id, selectedEvent.category)}
          onRejectCoffee={motivo => rejectCoffee(selectedEvent.id, selectedEvent.category, motivo)}
        />
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Administração · somente leitura + aprovação</p>
          <h1 style={{ fontFamily: "'Google Sans', sans-serif" }} className="text-3xl text-foreground">
            Todas as reservas
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-sm text-muted-foreground">{counts.total} reservas no total</p>
            {counts.pendente > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                <AlertCircle size={10} /> {counts.pendente} pendente{counts.pendente !== 1 ? "s" : ""}
              </span>
            )}
            {counts.cafePendente > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
                <Coffee size={10} /> {counts.cafePendente} café{counts.cafePendente !== 1 ? "s" : ""} pendente{counts.cafePendente !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1 min-w-48">
            <Search size={13} className="text-muted-foreground flex-shrink-0" />
            <input value={rawSearch} onChange={e => setRawSearch(e.target.value)}
              placeholder="Buscar por título, data, solicitante ou departamento…"
              className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none flex-1" />
            {rawSearch && (
              <button onClick={() => setRawSearch("")} className="text-muted-foreground hover:text-foreground transition-colors">
                <X size={11} />
              </button>
            )}
          </div>

          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground outline-none">
            <option value="">Todos os meses</option>
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, "0");
              return <option key={m} value={`${optionYear}-${m}`}>{MONTHS[i]} {optionYear}</option>;
            })}
          </select>

          <div className="relative" ref={filterRef}>
            <button onClick={() => setFilterOpen(o => !o)}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all",
                activeFilterCount > 0 ? "bg-[#5b4fcf] text-white border-[#5b4fcf]" : "bg-card border-border text-muted-foreground hover:text-foreground"
              )}>
              <Filter size={12} /> Filtros
              {activeFilterCount > 0 && (
                <span className="bg-white/25 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {filterOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-2xl shadow-xl border border-border z-20">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-xs font-semibold text-foreground">Filtros</span>
                  {activeFilterCount > 0 && (
                    <button onClick={() => { setFilterCategory("todas"); setFilterStatus("todas"); setFilterMonth(""); }}
                      className="text-[10px] text-[#5b4fcf] flex items-center gap-1">
                      <X size={10} /> Limpar
                    </button>
                  )}
                </div>
                <div className="px-4 py-3 space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Categoria</p>
                    {([
                      ["todas",        "Todas",            "#6b7280"],
                      ["MEETING_ROOM", "Salas de Reunião", "#0284c7"],
                      ["AUDITORIUM",   "Auditório",        "#5b4fcf"],
                      ["FLEET_VEHICLE","Frota",            "#f59e0b"],
                    ] as const).map(([key, label, color]) => (
                      <button key={key} onClick={() => setFilterCategory(key)}
                        className="w-full flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted hover:text-foreground transition-colors text-left">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs text-foreground flex-1">{label}</span>
                        {filterCategory === key && <Check size={11} className="text-[#5b4fcf]" />}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Status</p>
                    {([
                      ["todas",                "Todos"],
                      ["ENVIADA_PARA_ANALISE", "Pendente"],
                      ["APROVADA",             "Aprovada"],
                      ["REPROVADA",            "Reprovada"],
                      ["FINALIZADA",           "Finalizada"],
                      ["CANCELADA",            "Cancelada"],
                    ] as const).map(([key, label]) => (
                      <button key={key} onClick={() => setFilterStatus(key)}
                        className="w-full flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-muted hover:text-foreground transition-colors text-left">
                        <span className="text-xs text-foreground flex-1">{label}</span>
                        {filterStatus === key && <Check size={11} className="text-[#5b4fcf]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button onClick={() => loadCurrent(true)} disabled={loading} title="Recarregar reservas"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all bg-card border-border text-muted-foreground hover:text-foreground disabled:opacity-60 disabled:cursor-not-allowed">
            <RefreshCw size={12} className={clsx(loading && "animate-spin")} /> Atualizar
          </button>
        </div>

        {(searchQuery || activeFilterCount > 0) && (
          <p className="text-xs text-muted-foreground mb-4">
            {sorted.length} resultado{sorted.length !== 1 ? "s" : ""}
          </p>
        )}

        {loadError && (
          <div className="mb-4 px-4 py-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 flex items-center gap-2">
            <span className="text-xs text-red-500">Erro ao carregar reservas: {loadError}</span>
            <button onClick={() => loadCurrent(true)} className="ml-auto text-[11px] text-[#5b4fcf] hover:underline">
              Tentar de novo
            </button>
          </div>
        )}
        {loading && !loadError && (
          <div className="mb-4 px-4 py-2 rounded-xl border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">Carregando reservas…</span>
          </div>
        )}

        {sorted.length === 0 && !loading && !loadError ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Calendar size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma reserva encontrada</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pendentes.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                    <AlertCircle size={12} /> Aguardando análise
                  </span>
                  <div className="flex-1 h-px bg-amber-200 dark:bg-amber-800" />
                  <span className="text-[10px] text-muted-foreground">{pendentes.length} reserva{pendentes.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2">
                  {pendentes.map(ev => (
                    <EventRow key={`${ev.category}-${ev.id}`} ev={ev} onClick={() => setSelectedEvent(ev)} />
                  ))}
                </div>
              </div>
            )}

            {pendentes.length > 0 && demais.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground">Demais reservas</span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}

            {Object.entries(grouped).map(([date, evs]) => {
              const d = new Date(date + "T12:00:00");
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="text-xs font-semibold text-foreground capitalize">
                      {d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                    </div>
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground">{evs.length} reserva{evs.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="space-y-2">
                    {evs.map(ev => (
                      <EventRow key={`${ev.category}-${ev.id}`} ev={ev} onClick={() => setSelectedEvent(ev)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
