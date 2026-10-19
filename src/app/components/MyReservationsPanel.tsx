import { useCallback, useEffect, useRef, useState } from "react";
import { Building2, Mic, Car, CalendarDays, CalendarX, ChevronLeft, ChevronRight, RefreshCw, AlertTriangle, X } from "lucide-react";
import { clsx } from "clsx";
import { fetchUserReservations, type UserReservation } from "../../api/service/userReservationService";
import { fetchEventById } from "../context/EventsContext";
import { useCategoryColors } from "../context/CategoryColorsContext";
import { DatePicker } from "./FormPickers";
import { StatusBadge, CoffeeBadge, coffeeState, type CoffeeState } from "./StatusBadge";
import { ReservationDetails } from "./ReservationDetails";
import type { CalEvent, CategoryKey } from "../types/calendar";

const CATEGORY_INFO: Record<CategoryKey, { label: string; shortLabel: string; icon: React.ElementType }> = {
  MEETING_ROOM: { label: "Sala de reunião", shortLabel: "Sala de reunião", icon: Building2 },
  AUDITORIUM: { label: "Auditório", shortLabel: "Auditório", icon: Mic },
  FLEET_VEHICLE: { label: "Veículo da frota", shortLabel: "Frota", icon: Car },
};

const ALL_CATEGORIES: CategoryKey[] = ["MEETING_ROOM", "AUDITORIUM", "FLEET_VEHICLE"];

const UNKNOWN_COLOR = "#64748b";
const ACCENT = "#5b4fcf";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  });
}

function fmtLongDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtHorario(start: string, end: string): string {
  if (!start) return "Horário não informado";
  const inicio = start.slice(0, 5);
  if (!end) return inicio;
  const fim = end.slice(0, 5);
  if (fim === inicio) return inicio;
  return `${inicio} – ${fim}`;
}

function categoryLabel(item: UserReservation): string {
  if (item.category) return CATEGORY_INFO[item.category].label;
  if (item.reservationType) return item.reservationType;
  return "Reserva";
}

function categoryIcon(item: UserReservation): React.ElementType {
  if (item.category) return CATEGORY_INFO[item.category].icon;
  return CalendarDays;
}

function errorMessage(err: any, fallback: string): string {
  if (err?.detail) return err.detail;
  if (err?.title) return err.title;
  if (err?.message) return err.message;
  return fallback;
}

function ReservationModal({ item, color, onClose }: {
  item: UserReservation; color: string; onClose: () => void;
}) {
  const [event, setEvent] = useState<CalEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!item.category) {
      setError("Tipo de reserva desconhecido. Não foi possível buscar os detalhes.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchEventById(item.category, item.id);
      setEvent(data);
    } catch (err: any) {
      setError(errorMessage(err, "Não foi possível carregar os detalhes da reserva."));
    }
    setLoading(false);
  }, [item]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  let titulo = categoryLabel(item);
  if (event) titulo = event.title;

  let status = item.status;
  if (event) status = event.status;

  let cafe: CoffeeState = "sem-cafe";
  if (event) cafe = coffeeState(event);

  let data = item.reservationDate;
  if (event) data = event.date;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalhes da reserva"
        className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-lg mx-3 sm:mx-4 max-h-[92dvh] flex flex-col"
        style={{ animation: "modalIn 0.18s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div
          className="px-4 sm:px-6 pt-6 pb-4 flex items-start justify-between flex-shrink-0 border-b border-border"
          style={{ borderColor: color + "30" }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{categoryLabel(item)}</span>
            </div>
            <p className="text-xs text-muted-foreground capitalize mb-1">{fmtLongDate(data)}</p>
            <h2 style={{ fontFamily: "'Blinker', sans-serif" }} className="text-2xl text-foreground leading-snug break-words">
              {titulo}
            </h2>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {status && <StatusBadge status={status} />}
              {cafe !== "sem-cafe" && <CoffeeBadge state={cafe} />}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mt-0.5 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 sm:px-6 pb-4 pt-4 overflow-y-auto space-y-3" style={{ scrollbarWidth: "none" }}>
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="h-8 bg-muted/60 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mb-0.5">
                Não foi possível carregar a reserva
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 break-words">{error}</p>
              {item.category && (
                <button
                  onClick={load}
                  className="mt-2 px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity"
                  style={{ background: ACCENT }}
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          {!loading && event && event.status === "REPROVADA" && event.motivoReprova && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-red-600 font-semibold mb-0.5">Motivo da reprova</p>
              <p className="text-xs text-red-700 dark:text-red-300 break-words">{event.motivoReprova}</p>
            </div>
          )}

          {!loading && event && <ReservationDetails event={event} />}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-border flex items-center justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ background: color }}
          >
            Fechar
          </button>
        </div>
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

export default function MyReservationsPanel() {
  const { colors } = useCategoryColors();
  const [date, setDate] = useState("");
  const [tipos, setTipos] = useState<CategoryKey[]>([]);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<UserReservation[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<UserReservation | null>(null);
  const [alturaMinima, setAlturaMinima] = useState(0);

  const requestRef = useRef(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (targetPage: number, targetDate: string, targetTipos: CategoryKey[]) => {
    requestRef.current = requestRef.current + 1;
    const requestId = requestRef.current;

    setLoading(true);
    setError("");
    try {
      const data = await fetchUserReservations(targetPage, targetDate, targetTipos);
      if (requestId !== requestRef.current) return;

      if (targetPage > 0 && data.reservations.length === 0) {
        load(targetPage - 1, targetDate, targetTipos);
        return;
      }

      setItems(data.reservations);
      setPage(targetPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      if (requestId !== requestRef.current) return;
      if (targetPage === 0) {
        setItems([]);
        setPage(0);
        setTotalPages(0);
      }
      setError(errorMessage(err, "Não foi possível carregar suas reservas."));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(0, date, tipos); }, [date, tipos, load]);

  function segurarAltura() {
    if (listaRef.current) {
      setAlturaMinima(listaRef.current.offsetHeight);
    }
  }

  function alternarTipo(tipo: CategoryKey) {
    segurarAltura();
    if (tipos.includes(tipo)) {
      setTipos(tipos.filter(t => t !== tipo));
    } else {
      setTipos([...tipos, tipo]);
    }
  }

  function mudarData(valor: string) {
    segurarAltura();
    setDate(valor);
  }

  function limparFiltros() {
    segurarAltura();
    setDate("");
    setTipos([]);
  }

  function colorFor(item: UserReservation): string {
    if (item.category) return colors[item.category];
    return UNKNOWN_COLOR;
  }

  const temProxima = page + 1 < totalPages;
  const mostrarPager = items.length > 0 && totalPages > 1;
  const temFiltro = date !== "" || tipos.length > 0;

  let mensagemVazia = "Você ainda não tem reservas.";
  if (temFiltro) mensagemVazia = "Você não tem reservas com os filtros selecionados.";

  return (
    <div className="w-full mt-12">
      <div data-tour="home-minhas-reservas" className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">Minhas reservas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Clique em uma reserva para ver todos os detalhes.</p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 lg:justify-end">
          <div role="group" aria-label="Filtrar por tipo de reserva" className="grid grid-cols-3 gap-1.5 sm:grid-cols-[repeat(3,1fr)]">
            {ALL_CATEGORIES.map(c => {
              const Icon = CATEGORY_INFO[c].icon;
              const color = colors[c];
              const ativo = tipos.includes(c);
              let estilo = {};
              if (ativo) estilo = { borderColor: color, background: color + "20" };
              return (
                <button
                  key={c}
                  onClick={() => alternarTipo(c)}
                  aria-pressed={ativo}
                  className={clsx(
                    "flex items-center justify-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full border text-[11px] font-medium leading-tight sm:leading-normal text-center sm:whitespace-nowrap transition-colors",
                    ativo ? "text-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                  style={estilo}
                >
                  <Icon size={12} className="flex-shrink-0" style={{ color }} />
                  {CATEGORY_INFO[c].shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none sm:w-48">
              <DatePicker value={date} onChange={mudarData} placeholder="Todas as datas" />
            </div>
            <button
              onClick={limparFiltros}
              disabled={!temFiltro}
              aria-label="Limpar filtros"
              title="Limpar filtros"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-default"
            >
              <X size={13} />
            </button>
            <button
              onClick={() => load(page, date, tipos)}
              disabled={loading}
              aria-label="Atualizar"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-default"
            >
              <RefreshCw size={13} className={clsx(loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      <div ref={listaRef} style={{ minHeight: alturaMinima }}>
        {loading && items.length === 0 && (
          <div className="space-y-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-16 bg-card rounded-xl border border-border/50 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && items.length === 0 && (
          <div className="flex flex-col items-center text-center px-6 py-10 bg-card rounded-2xl border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <AlertTriangle size={17} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Não foi possível carregar suas reservas</p>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{error}</p>
            <button
              onClick={() => load(0, date, tipos)}
              className="mt-3 px-3 py-1.5 rounded-lg text-white text-xs font-medium hover:opacity-90 transition-opacity"
              style={{ background: ACCENT }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center text-center px-6 py-10 bg-card rounded-2xl border border-border/50">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
              <CalendarX size={17} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Nenhuma reserva encontrada</p>
            <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
              {mensagemVazia}
            </p>
          </div>
        )}

        {items.length > 0 && (
          <div className={clsx("space-y-1.5 transition-opacity", loading && "opacity-60 pointer-events-none")}>
            {items.map(item => {
              const Icon = categoryIcon(item);
              const color = colorFor(item);
              return (
                <button
                  key={`${item.reservationType}-${item.id}`}
                  onClick={() => setSelected(item)}
                  className="group w-full flex items-center gap-3 p-3 sm:p-3.5 bg-card rounded-xl border border-border/50 hover:border-border hover:shadow-sm transition-all text-left"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: color + "20" }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{categoryLabel(item)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="capitalize">{fmtDate(item.reservationDate)}</span>
                      <span>·</span>
                      <span>{fmtHorario(item.startTime, item.endTime)}</span>
                    </p>
                  </div>
                  {item.status && (
                    <div className="flex-shrink-0">
                      <StatusBadge status={item.status} />
                    </div>
                  )}
                  <ChevronRight
                    size={14}
                    className="text-muted-foreground flex-shrink-0 group-hover:text-foreground group-hover:translate-x-0.5 transition-all"
                  />
                </button>
              );
            })}
          </div>
        )}

        {error && items.length > 0 && (
          <p className="text-[11px] text-red-600 mt-3">{error}</p>
        )}

        {mostrarPager && (
          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-[11px] text-muted-foreground">Página {page + 1} de {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => load(page - 1, date, tipos)}
                disabled={page === 0 || loading}
                aria-label="Página anterior"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
              >
                <ChevronLeft size={13} />
              </button>
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium text-white"
                style={{ background: ACCENT }}
              >
                {page + 1}
              </span>
              <button
                onClick={() => load(page + 1, date, tipos)}
                disabled={!temProxima || loading}
                aria-label="Próxima página"
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
              >
                {loading ? <RefreshCw size={13} className="animate-spin" /> : <ChevronRight size={13} />}
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <ReservationModal
          item={selected}
          color={colorFor(selected)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
