import { useEffect, useState } from "react";
import { Mail, MailX, Loader2, RefreshCw, Info, AlertTriangle } from "lucide-react";
import { clsx } from "clsx";
import { Switch } from "../../components/ui/switch";
import { smtpService } from "../../../api/service/smtpService";

export default function SmtpSection() {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function carregar() {
    setLoading(true);
    setLoadError(null);
    smtpService.buscarStatus()
      .then(status => setActive(status))
      .catch((err: any) => setLoadError(err?.detail ?? err?.message ?? "Não foi possível carregar o status do SMTP."))
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  async function toggle() {
    if (saving) return;
    const novo = !active;
    setSaveError(null);
    setSaving(true);
    setActive(novo);
    try {
      await smtpService.definirStatus(novo);
    } catch (err: any) {
      setActive(!novo);
      setSaveError(err?.detail ?? err?.message ?? "Não foi possível alterar o SMTP. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground">SMTP</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Liga ou desliga o envio de e-mails pelo sistema.
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
            <p className="text-sm text-foreground">Erro ao carregar o SMTP</p>
            <p className="text-xs text-muted-foreground mt-0.5">{loadError}</p>
            <button onClick={carregar} className="text-xs text-[#5b4fcf] mt-2 hover:underline">Tentar de novo</button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 p-5 bg-card rounded-2xl border border-border/50 text-xs text-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> Carregando SMTP…
        </div>
      ) : (
        <>
          <label
            className={clsx(
              "flex items-center gap-4 p-4 bg-card rounded-2xl border transition-colors cursor-pointer",
              active ? "border-border/50" : "border-dashed border-border"
            )}
          >
            <div className={clsx(
              "w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
              active ? "bg-emerald-500/10" : "bg-muted"
            )}>
              {active ? (
                <Mail size={15} className="text-emerald-600" />
              ) : (
                <MailX size={15} className="text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={clsx("text-sm font-semibold leading-snug", active ? "text-foreground" : "text-muted-foreground")}>
                {active ? "Ligado" : "Desligado"}
              </p>
              <p className="text-xs text-muted-foreground">
                {active ? "O sistema está enviando e-mails" : "Nenhum e-mail está sendo enviado"}
              </p>
            </div>

            {saving && (
              <Loader2 size={13} className="animate-spin text-muted-foreground flex-shrink-0" />
            )}

            <Switch
              checked={active}
              onCheckedChange={toggle}
              disabled={busy}
              aria-label="Ligar envio de e-mails"
              className="flex-shrink-0"
            />
          </label>

          {!active && (
            <div className="flex items-start gap-2.5 px-4 py-3 mt-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Com o SMTP desligado, ninguém recebe e-mail do sistema.
              </p>
            </div>
          )}
        </>
      )}

      <div className="mt-6 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          A mudança é salva no servidor na hora, vale para todo o sistema e fica registrada nos logs.
        </p>
      </div>
    </div>
  );
}
