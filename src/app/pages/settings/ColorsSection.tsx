import { useState } from "react";
import { RotateCcw, Info, Check, Loader2 } from "lucide-react";
import { useCategoryColors, DEFAULT_COLORS } from "../../context/CategoryColorsContext";
import type { CategoryKey } from "../../types/calendar";

const CATEGORIES: { key: CategoryKey; label: string; hint: string }[] = [
  { key: "MEETING_ROOM",  label: "Salas de Reunião",           hint: "Reservas de sala no calendário e na Administração." },
  { key: "AUDITORIUM",    label: "Auditório",                  hint: "Reservas do auditório." },
  { key: "FLEET_VEHICLE", label: "Veículos Oficiais da Frota", hint: "Reservas de veículo da frota." },
];

function ColorRow({
  label,
  hint,
  color,
  defaultColor,
  onChange,
}: {
  label: string;
  hint: string;
  color: string;
  defaultColor: string;
  onChange: (hex: string) => void;
}) {
  const isDefault = color.toLowerCase() === defaultColor.toLowerCase();

  return (
    <div className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-snug">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{hint}</p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => onChange(defaultColor)}
          disabled={isDefault}
          title={isDefault ? "Já está na cor padrão" : "Restaurar a cor padrão desta categoria"}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground disabled:cursor-default"
        >
          <RotateCcw size={13} />
        </button>

        <div
          className="relative w-11 h-11 rounded-xl border border-black/5 dark:border-white/10 transition-shadow hover:shadow-md"
          style={{ background: color }}
          title="Escolher a cor"
        >
          <input
            type="color"
            value={color}
            onChange={e => onChange(e.target.value.toLowerCase())}
            aria-label={`Cor de ${label}`}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

export default function ColorsSection() {
  const { colors, setColor, resetColors, saveColors, hasChanges, saving } = useCategoryColors();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const allDefault = CATEGORIES.every(
    c => colors[c.key].toLowerCase() === DEFAULT_COLORS[c.key].toLowerCase()
  );

  const handleSave = async () => {
    setStatus("idle");
    try {
      await saveColors();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Cores das reservas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escolha a cor de cada categoria como você prefere vê-la no calendário.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={resetColors}
            disabled={allDefault}
            className="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:cursor-default"
          >
            <RotateCcw size={12} /> Restaurar padrões
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-default"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {status === "saved" && !hasChanges && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">Cores salvas na sua conta.</p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive mb-3">Não foi possível salvar as cores. Tente novamente.</p>
      )}

      <div className="space-y-3">
        {CATEGORIES.map(c => (
          <ColorRow
            key={c.key}
            label={c.label}
            hint={c.hint}
            color={colors[c.key]}
            defaultColor={DEFAULT_COLORS[c.key]}
            onChange={hex => setColor(c.key, hex)}
          />
        ))}
      </div>

      <div className="mt-6">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">Prévia</p>
        <div className="p-4 bg-card rounded-2xl border border-border/50 space-y-1.5">
          {CATEGORIES.map(c => (
            <div
              key={c.key}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              style={{ background: colors[c.key] + "20", color: colors[c.key] }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors[c.key] }} />
              <span className="truncate">{c.label}</span>
              <span className="ml-auto opacity-70 flex-shrink-0">09:00 – 10:00</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          As cores valem só para você — não mudam o que os outros usuários veem. Clique em{" "}
          <strong className="font-medium text-foreground">Salvar</strong> para guardá-las na{" "}
          <strong className="font-medium text-foreground">sua conta</strong>, em qualquer navegador.
        </p>
      </div>
    </div>
  );
}
