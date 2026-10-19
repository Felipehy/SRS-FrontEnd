import { useEffect, useState } from "react";
import { Building2, Loader2, RefreshCw, Info, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { clsx } from "clsx";
import { Switch } from "../../components/ui/switch";
import { roomService, type RoomOption } from "../../../api/service/roomService";

export default function RoomsSection() {
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function carregar() {
    setLoading(true);
    setLoadError(null);
    roomService.listar()
      .then(lista => setRooms(lista))
      .catch((err: any) => setLoadError(err?.detail ?? err?.message ?? "Não foi possível carregar as salas."))
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  const visibleCount = rooms.filter(r => r.isActive).length;
  const busy = loading || bulkLoading;

  function aplicarLocal(id: number, isActive: boolean) {
    setRooms(prev => prev.map(r => (r.id === id ? { ...r, isActive } : r)));
  }

  async function toggle(room: RoomOption) {
    if (pendingIds.includes(room.id)) return;
    setSaveError(null);
    setPendingIds(prev => [...prev, room.id]);
    aplicarLocal(room.id, !room.isActive);
    try {
      await roomService.definirVisibilidade(room.id, !room.isActive);
    } catch (err: any) {
      aplicarLocal(room.id, room.isActive);
      setSaveError(err?.detail ?? err?.message ?? "Não foi possível alterar a sala. Tente novamente.");
    } finally {
      setPendingIds(prev => prev.filter(id => id !== room.id));
    }
  }

  async function setAll(isActive: boolean) {
    const alvos = rooms.filter(r => r.isActive !== isActive);
    if (alvos.length === 0) return;
    setSaveError(null);
    setBulkLoading(true);
    try {
      for (const room of alvos) {
        await roomService.definirVisibilidade(room.id, isActive);
        aplicarLocal(room.id, isActive);
      }
    } catch (err: any) {
      setSaveError(err?.detail ?? err?.message ?? "Não foi possível alterar as salas. Tente novamente.");
    } finally {
      setBulkLoading(false);
      carregar();
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Salas de reunião</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escolha quais salas ficam disponíveis para seleção no formulário de reserva.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={carregar}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            <RefreshCw size={12} className={clsx(loading && "animate-spin")} /> Atualizar
          </button>
        </div>
      </div>

      {saveError && (
        <p className="text-xs text-destructive mb-3">{saveError}</p>
      )}

      {loadError ? (
        <div className="flex items-start gap-3 p-5 bg-card rounded-2xl border border-border/50">
          <AlertTriangle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground">Erro ao carregar as salas</p>
            <p className="text-xs text-muted-foreground mt-0.5">{loadError}</p>
            <button onClick={carregar} className="text-xs text-[#5b4fcf] mt-2 hover:underline">Tentar de novo</button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 p-5 bg-card rounded-2xl border border-border/50 text-xs text-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> Carregando salas…
        </div>
      ) : rooms.length === 0 ? (
        <div className="p-5 bg-card rounded-2xl border border-border/50">
          <p className="text-sm text-foreground">Nenhuma sala cadastrada</p>
          <p className="text-xs text-muted-foreground mt-0.5">O cadastro de salas é feito no back-end.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-medium text-foreground">{visibleCount}</strong> de {rooms.length} sala{rooms.length !== 1 ? "s" : ""} disponíve{visibleCount === 1 ? "l" : "is"} para reserva
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAll(true)}
                disabled={busy || visibleCount === rooms.length}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default"
              >
                <Eye size={11} /> Todas
              </button>
              <button
                onClick={() => setAll(false)}
                disabled={busy || visibleCount === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-default"
              >
                <EyeOff size={11} /> Nenhuma
              </button>
            </div>
          </div>

          {visibleCount === 0 && (
            <div className="flex items-start gap-2.5 px-4 py-3 mb-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Sem nenhuma sala liberada, ninguém consegue abrir uma reserva de sala de reunião.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {rooms.map(room => (
              <label
                key={room.id}
                className={clsx(
                  "flex items-center gap-4 p-4 bg-card rounded-2xl border transition-colors cursor-pointer",
                  room.isActive ? "border-border/50" : "border-dashed border-border"
                )}
              >
                <div className={clsx(
                  "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                  room.isActive ? "bg-[#0284c7]/10" : "bg-muted"
                )}>
                  <Building2 size={15} className={room.isActive ? "text-[#0284c7]" : "text-muted-foreground"} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className={clsx("text-sm font-semibold leading-snug truncate", room.isActive ? "text-foreground" : "text-muted-foreground")}>
                    {room.floor}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {room.isActive ? "Aparece no formulário de reserva" : "Oculta no formulário de reserva"}
                  </p>
                </div>

                {pendingIds.includes(room.id) && (
                  <Loader2 size={13} className="animate-spin text-muted-foreground flex-shrink-0" />
                )}

                <Switch
                  checked={room.isActive}
                  onCheckedChange={() => toggle(room)}
                  disabled={busy || pendingIds.includes(room.id)}
                  aria-label={`Mostrar ${room.floor} nas reservas`}
                  className="flex-shrink-0"
                />
              </label>
            ))}
          </div>
        </>
      )}

      <div className="mt-6 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Cada mudança é salva no servidor na hora e vale para todos os usuários. Salas ocultas somem apenas do
          formulário de nova reserva — as reservas já existentes continuam aparecendo no calendário.
        </p>
      </div>
    </div>
  );
}
