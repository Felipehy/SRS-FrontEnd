import { useState } from "react";
import { Check, Info, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import { useNavLayout, type NavLayout } from "../../context/NavLayoutContext";

const OPTIONS: { key: NavLayout; label: string; hint: string }[] = [
  { key: "navbar",  label: "Barra superior", hint: "As rotas ficam no topo da tela." },
  { key: "sidebar", label: "Barra lateral",  hint: "As rotas ficam fixas na lateral esquerda." },
];

function LayoutPreview({ type }: { type: NavLayout }) {
  if (type === "navbar") {
    return (
      <div className="w-full h-20 rounded-lg border border-border/60 bg-background overflow-hidden flex flex-col">
        <div className="h-4 flex-shrink-0 bg-navbar flex items-center gap-1 px-1.5">
          <span className="w-1.5 h-1.5 rounded-sm bg-[#5b4fcf] flex-shrink-0" />
          <span className="w-5 h-1 rounded-full bg-white/60" />
          <span className="w-5 h-1 rounded-full bg-white/30" />
          <span className="w-5 h-1 rounded-full bg-white/30" />
        </div>
        <div className="flex-1 p-2 space-y-1.5">
          <div className="w-2/3 h-1.5 rounded-full bg-muted-foreground/25" />
          <div className="w-full h-1.5 rounded-full bg-muted-foreground/10" />
          <div className="w-5/6 h-1.5 rounded-full bg-muted-foreground/10" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-20 rounded-lg border border-border/60 bg-background overflow-hidden flex">
      <div className="w-8 flex-shrink-0 bg-navbar flex flex-col gap-1.5 p-1.5">
        <span className="w-1.5 h-1.5 rounded-sm bg-[#5b4fcf] flex-shrink-0" />
        <span className="w-full h-1 rounded-full bg-white/60" />
        <span className="w-full h-1 rounded-full bg-white/30" />
        <span className="w-full h-1 rounded-full bg-white/30" />
      </div>
      <div className="flex-1 p-2 space-y-1.5">
        <div className="w-2/3 h-1.5 rounded-full bg-muted-foreground/25" />
        <div className="w-full h-1.5 rounded-full bg-muted-foreground/10" />
        <div className="w-5/6 h-1.5 rounded-full bg-muted-foreground/10" />
      </div>
    </div>
  );
}

export default function NavigationSection() {
  const { navLayout, setNavLayout, saveLayout, hasChanges, saving } = useNavLayout();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const handleSave = async () => {
    setStatus("idle");
    try {
      await saveLayout();
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Posição da navegação</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Escolha onde as rotas de reservas aparecem. Só uma opção fica ativa por vez.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-default flex-shrink-0"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {status === "saved" && !hasChanges && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-3">Preferência salva na sua conta.</p>
      )}
      {status === "error" && (
        <p className="text-xs text-destructive mb-3">Não foi possível salvar a preferência. Tente novamente.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Posição da navegação">
        {OPTIONS.map(opt => {
          const isActive = navLayout === opt.key;
          return (
            <button
              key={opt.key}
              role="radio"
              aria-checked={isActive}
              onClick={() => setNavLayout(opt.key)}
              className={clsx(
                "text-left p-4 bg-card rounded-2xl border transition-all",
                isActive
                  ? "border-[#5b4fcf] ring-1 ring-[#5b4fcf]"
                  : "border-border/50 hover:border-border"
              )}
            >
              <LayoutPreview type={opt.key} />
              <div className="flex items-center justify-between gap-2 mt-3">
                <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                <span
                  className={clsx(
                    "w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0",
                    isActive ? "bg-[#5b4fcf] border-[#5b4fcf]" : "border-muted-foreground/40"
                  )}
                >
                  {isActive && <Check size={10} className="text-white" />}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          A mudança é aplicada na hora. Clique em{" "}
          <strong className="font-medium text-foreground">Salvar</strong> para guardá-la na{" "}
          <strong className="font-medium text-foreground">sua conta</strong>, em qualquer navegador.
        </p>
      </div>
    </div>
  );
}
