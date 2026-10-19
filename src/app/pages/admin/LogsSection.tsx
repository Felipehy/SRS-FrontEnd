import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X, RefreshCw, AlertTriangle, FileText, Plus, Pencil, Trash2, FileQuestion, ChevronLeft, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { clsx } from "clsx";
import { fetchLogs, fullName, type LogEntry, type LogType } from "../../../api/service/logService";
import { formatInstant } from "../../utils/datetime";

const TYPE_CONFIG: Record<LogType, { label: string; icon: React.ElementType; cls: string; dot: string }> = {
  CREATE:  { label: "Criação",    icon: Plus,         cls: "text-blue-600    bg-blue-50    dark:bg-blue-950/30    border-blue-200    dark:border-blue-800",    dot: "bg-blue-500"    },
  UPDATE:  { label: "Alteração",  icon: Pencil,       cls: "text-amber-600   bg-amber-50   dark:bg-amber-950/30   border-amber-200   dark:border-amber-800",   dot: "bg-amber-500"   },
  APPROVE: { label: "Aprovação",  icon: CheckCircle2, cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800", dot: "bg-emerald-500" },
  REJECT:  { label: "Reprovação", icon: XCircle,      cls: "text-rose-600    bg-rose-50    dark:bg-rose-950/30    border-rose-200    dark:border-rose-800",    dot: "bg-rose-500"    },
  DELETE:  { label: "Exclusão",   icon: Trash2,       cls: "text-red-600     bg-red-50     dark:bg-red-950/30     border-red-200     dark:border-red-800",     dot: "bg-red-500"     },
  UNKNOWN: { label: "Outro",      icon: FileQuestion, cls: "text-muted-foreground bg-muted border-border",                                                     dot: "bg-muted-foreground" },
};

const TYPES: LogType[] = ["CREATE", "UPDATE", "APPROVE", "REJECT", "DELETE"];

const PAGE_SIZE_FALLBACK = 10;

const RESERVATION_LABELS: Record<string, string> = {
  MEETING_ROOM: "Sala de reunião",
  AUDITORIUM: "Auditório",
  FLEET_VEHICLE: "Veículo de frota",
};

function reservationLabel(value: string) {
  if (RESERVATION_LABELS[value]) return RESERVATION_LABELS[value];
  return value;
}

function TypeBadge({ type }: { type: LogType }) {
  const cfg = TYPE_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <span className={clsx("inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0", cfg.cls)}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function formatTimestamp(iso: string) {
  const texto = formatInstant(iso, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  if (!texto) return iso || "—";
  return texto;
}

function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14 bg-card rounded-2xl border border-border/50">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Icon size={17} className="text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
      <div className="text-xs text-muted-foreground max-w-sm leading-relaxed">{children}</div>
    </div>
  );
}

function contagem(n: number, singular: string, plural: string) {
  if (n === 1) return `1 ${singular}`;
  return `${n} ${plural}`;
}

function buildResumo(logs: LogEntry[]) {
  let aprovacoes = 0;
  let reprovacoes = 0;
  for (const log of logs) {
    if (log.typeLog === "APPROVE") aprovacoes++;
    if (log.typeLog === "REJECT") reprovacoes++;
  }

  const partes = [contagem(logs.length, "registro", "registros")];
  if (aprovacoes > 0) partes.push(contagem(aprovacoes, "aprovação", "aprovações"));
  if (reprovacoes > 0) partes.push(contagem(reprovacoes, "reprovação", "reprovações"));
  return partes.join(" · ");
}

function errorMessage(err: any) {
  if (err?.detail) return err.detail;
  if (err?.title) return err.title;
  if (err?.message) return err.message;
  return "Não foi possível carregar os logs.";
}

function buildPageList(current: number, total: number): (number | "gap")[] {
  if (total <= 7) {
    const todas: (number | "gap")[] = [];
    for (let i = 0; i < total; i++) todas.push(i);
    return todas;
  }

  let inicio = Math.max(1, current - 1);
  let fim = Math.min(total - 2, current + 1);
  if (current <= 2) {
    inicio = 1;
    fim = 3;
  }
  if (current >= total - 3) {
    inicio = total - 4;
    fim = total - 2;
  }

  const paginas: (number | "gap")[] = [0];
  if (inicio > 1) paginas.push("gap");
  for (let i = inicio; i <= fim; i++) paginas.push(i);
  if (fim < total - 2) paginas.push("gap");
  paginas.push(total - 1);
  return paginas;
}

function Pager({
  page,
  totalPages,
  hasMore,
  loading,
  onGo,
}: {
  page: number;
  totalPages: number;
  hasMore: boolean;
  loading: boolean;
  onGo: (target: number) => void;
}) {
  const podeVoltar = page > 0;
  const podeAvancar = page + 1 < totalPages || hasMore;

  return (
    <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
      <p className="text-[11px] text-muted-foreground">
        Página {page + 1} de {totalPages}
        {hasMore && "+"}
      </p>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onGo(page - 1)}
          disabled={!podeVoltar || loading}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          aria-label="Página anterior"
        >
          <ChevronLeft size={13} />
        </button>

        {buildPageList(page, totalPages).map((item, index) => {
          if (item === "gap") {
            return (
              <span key={`gap-${index}`} className="w-8 h-8 flex items-center justify-center text-[11px] text-muted-foreground">
                …
              </span>
            );
          }
          return (
            <button
              key={item}
              onClick={() => onGo(item)}
              disabled={loading}
              className={clsx(
                "w-8 h-8 rounded-lg border text-xs font-medium transition-colors disabled:cursor-default",
                item === page
                  ? "bg-[#5b4fcf] text-white border-[#5b4fcf]"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {item + 1}
            </button>
          );
        })}

        <button
          onClick={() => onGo(page + 1)}
          disabled={!podeAvancar || loading}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          aria-label="Próxima página"
        >
          {loading ? <RefreshCw size={13} className="animate-spin" /> : <ChevronRight size={13} />}
        </button>
      </div>
    </div>
  );
}

export default function LogsSection() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [page, setPage] = useState(0);
  const [loadedPages, setLoadedPages] = useState(0);
  const [pageSize, setPageSize] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState<LogType | "todos">("todos");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const first = await fetchLogs(0);
      setLogs(first);
      setPage(0);
      setLoadedPages(1);
      setPageSize(first.length);
      setHasMore(first.length > 0);
    } catch (err: any) {
      setLogs([]);
      setLoadedPages(0);
      setHasMore(false);
      setError(errorMessage(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { setPage(0); }, [search, type]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter(log => {
      if (type !== "todos" && log.typeLog !== type) return false;
      if (!q) return true;
      const campos = [
        fullName(log),
        log.email,
        log.ip,
        log.modification,
        log.localModification,
        reservationLabel(log.reservationType),
        log.groups.join(" "),
      ];
      return campos.some(v => v.toLowerCase().includes(q));
    });
  }, [logs, search, type]);

  const total = logs.length;
  const resumo = useMemo(() => buildResumo(logs), [logs]);

  const hasFilter = search.trim().length > 0 || type !== "todos";

  const size = pageSize > 0 ? pageSize : PAGE_SIZE_FALLBACK;
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const podeCarregarMais = hasMore && !hasFilter;
  const visible = filtered.slice(page * size, page * size + size);

  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  async function goTo(target: number) {
    if (loadingMore) return;
    if (target < 0) return;

    if (target < totalPages) {
      setPage(target);
      return;
    }
    if (!podeCarregarMais) return;

    const next = loadedPages;
    setLoadingMore(true);
    try {
      const more = await fetchLogs(next);
      setLoadedPages(next + 1);

      if (more.length === 0) {
        setHasMore(false);
      } else {
        const ids = new Set(logs.map(log => log.id));
        const novos = more.filter(log => !ids.has(log.id));
        if (novos.length > 0) {
          setLogs(current => current.concat(novos));
          setPage(target);
        }
        if (pageSize > 0 && more.length < pageSize) setHasMore(false);
      }
    } catch (err: any) {
      setError(errorMessage(err));
    }
    setLoadingMore(false);
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Logs do sistema</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading ? "Registros de alterações nas reservas." : resumo}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-default"
        >
          <RefreshCw size={12} className={clsx(loading && "animate-spin")} /> Atualizar
        </button>
      </div>

      {!loading && total > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 flex-1 min-w-48">
            <Search size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por usuário, IP, local ou alteração…"
              className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none flex-1"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Limpar busca">
                <X size={11} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 flex-wrap">
            {(["todos", ...TYPES] as const).map(key => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  type === key ? "bg-[#5b4fcf] text-white" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {key !== "todos" && (
                  <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", type === key ? "bg-white" : TYPE_CONFIG[key].dot)} />
                )}
                {key === "todos" ? "Todos" : TYPE_CONFIG[key].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-card rounded-xl border border-border/50 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && error && total === 0 && (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar os logs">
          <p>{error}</p>
          <button onClick={load} className="mt-3 px-3 py-1.5 rounded-lg bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity">
            Tentar novamente
          </button>
        </EmptyState>
      )}

      {!loading && !error && total === 0 && (
        <EmptyState icon={FileText} title="Nenhum log registrado">
          Não há registros de alterações em reservas no momento.
        </EmptyState>
      )}

      {!loading && total > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} title="Nenhum log encontrado">
          Nenhum registro corresponde à busca ou ao filtro aplicado.
        </EmptyState>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-1.5">
          {visible.map(log => (
            <div key={log.id} className="flex items-start gap-3 p-3.5 bg-card rounded-xl border border-border/50">
              <div className="pt-0.5">
                <TypeBadge type={log.typeLog} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed break-words">
                  <span className="font-medium">{fullName(log)}</span>
                  {log.modification && <> — {log.modification}</>}
                </p>
                <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-muted-foreground">
                  <span className="font-mono">{formatTimestamp(log.modificationDate)}</span>
                  {log.email && <><span>·</span><span>{log.email}</span></>}
                  {log.ip && <><span>·</span><span className="font-mono">{log.ip}</span></>}
                  {log.reservationType && <><span>·</span><span>{reservationLabel(log.reservationType)}</span></>}
                  {log.localModification && <><span>·</span><span>{log.localModification}</span></>}
                  {log.idData !== null && <><span>·</span><span className="font-mono">#{log.idData}</span></>}
                </div>
                {log.groups.length > 0 && (
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {log.groups.map(group => (
                      <span key={group} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50">
                        {group}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && total > 0 && error && (
        <p className="text-[11px] text-red-600 mt-3">{error}</p>
      )}

      {!loading && filtered.length > 0 && (totalPages > 1 || podeCarregarMais) && (
        <Pager
          page={page}
          totalPages={totalPages}
          hasMore={podeCarregarMais}
          loading={loadingMore}
          onGo={goTo}
        />
      )}
    </div>
  );
}
