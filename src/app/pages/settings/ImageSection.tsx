import { useState, useRef, useEffect, useCallback } from "react";
import { ImagePlus, Upload, X, AlertCircle, CheckCircle2, Info, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import { uploadEfsFile, deleteEfsFile } from "../../../api/service/efsService";

const MAX_BYTES = 50 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  const mb = bytes / (1024 * 1024);
  if (Number.isInteger(mb)) return `${mb} MB`;
  return `${mb.toFixed(1)} MB`;
}

function validate(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Selecione um arquivo de imagem (PNG, JPG ou WebP).";
  if (!ACCEPT.split(",").includes(file.type)) return "Formato não suportado. Use PNG, JPG ou WebP.";
  if (file.size > MAX_BYTES) return `A imagem tem ${formatSize(file.size)} — o limite é ${formatSize(MAX_BYTES)}.`;
  if (file.size === 0) return "O arquivo está vazio.";
  return null;
}

export default function ImageSection() {
  const { user, refreshPicture } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<"uploaded" | "removed" | null>(null);
  const [removing, setRemoving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = useCallback((f: File | null | undefined) => {
    if (!f) return;
    const problem = validate(f);
    setDone(null);
    setConfirmingRemove(false);
    if (problem) {
      setError(problem);
      setFile(null);
      return;
    }
    setError("");
    setFile(f);
  }, []);

  const clear = () => {
    setFile(null);
    setError("");
    setDone(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      await uploadEfsFile(file, setProgress);
      setDone("uploaded");
      refreshPicture();
    } catch (err: any) {
      if (err?.status === 413) {
        setError(`A imagem é grande demais para o servidor (${formatSize(file.size)}). Tente uma menor.`);
      } else {
        setError(err?.detail ?? err?.message ?? "Não foi possível enviar a imagem. Tente novamente.");
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const remove = async () => {
    setRemoving(true);
    setError("");
    try {
      await deleteEfsFile();
    } catch (err: any) {
      if (err?.status !== 404) {
        setError(err?.detail ?? err?.message ?? "Não foi possível remover a foto. Tente novamente.");
        setRemoving(false);
        return;
      }
    }
    setConfirmingRemove(false);
    setDone("removed");
    refreshPicture();
    setRemoving(false);
  };

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-foreground">Foto de perfil</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Escolha uma imagem PNG, JPG ou WebP de até {formatSize(MAX_BYTES)}.
        </p>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <UserAvatar
          name={user?.name}
          initials={user?.initials ?? "?"}
          pictureUrl={user?.pictureUrl}
          className="w-16 h-16"
          textClassName="text-lg"
          onStatusChange={s => {
            if (s === "loaded") setHasPhoto(true);
            else if (s === "error") setHasPhoto(false);
            else setHasPhoto(null);
          }}
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{user?.name || "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasPhoto === null
              ? "Verificando…"
              : hasPhoto
                ? "Sua foto atual. Envie outra para substituí-la."
                : "Sem foto — exibimos as iniciais do seu nome."}
          </p>

          {hasPhoto && (
            confirmingRemove ? (
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-muted-foreground">Remover a foto?</span>
                <button
                  type="button"
                  onClick={remove}
                  disabled={removing}
                  className="text-[11px] font-medium text-red-600 hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  {removing ? "Removendo…" : "Sim, remover"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingRemove(false)}
                  disabled={removing}
                  className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setConfirmingRemove(true); setDone(null); setError(""); }}
                disabled={busy}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-red-600 transition-colors mt-1.5 disabled:opacity-40 disabled:hover:text-muted-foreground"
              >
                <Trash2 size={11} /> Remover foto
              </button>
            )
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={e => pick(e.target.files?.[0])}
        className="hidden"
      />

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
          className={clsx(
            "w-full flex flex-col items-center gap-3 px-6 py-10 rounded-2xl border-2 border-dashed transition-colors",
            dragging
              ? "border-[#5b4fcf] bg-[#5b4fcf]/5"
              : "border-border bg-card hover:border-[#5b4fcf]/40"
          )}
        >
          <div className="w-12 h-12 rounded-2xl bg-[#5b4fcf]/10 flex items-center justify-center">
            <ImagePlus size={20} className="text-[#5b4fcf]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {hasPhoto ? "Clique para trocar a foto" : "Clique para escolher uma foto"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">ou arraste o arquivo até aqui</p>
          </div>
        </button>
      ) : (
        <div className="p-4 bg-card rounded-2xl border border-border/50">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-muted flex-shrink-0 border border-black/5 dark:border-white/10">
              {preview && <img src={preview} alt="Prévia da imagem escolhida" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatSize(file.size)} · {file.type.replace("image/", "").toUpperCase()}
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="text-[11px] text-[#5b4fcf] hover:underline mt-1.5 disabled:opacity-40 disabled:no-underline"
              >
                Trocar imagem
              </button>
            </div>
            <button
              type="button"
              onClick={clear}
              disabled={busy}
              title="Remover a imagem escolhida"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0 disabled:opacity-30"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {busy && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground">
              {progress === 100 ? "Processando no servidor…" : "Enviando…"}
            </span>
            {progress !== null && (
              <span className="text-[11px] text-muted-foreground tabular-nums">{progress}%</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={clsx(
                "h-full rounded-full bg-[#5b4fcf]",
                progress === null ? "w-1/3 animate-pulse" : "transition-[width] duration-200"
              )}
              style={progress !== null ? { width: `${progress}%` } : undefined}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <AlertCircle size={13} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{error}</p>
        </div>
      )}

      {done && (
        <div className="mt-3 flex items-center gap-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-3">
          <CheckCircle2 size={13} className="text-green-600 flex-shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-400">
            {done === "uploaded"
              ? "Foto de perfil atualizada — já aparece no menu do topo."
              : "Foto removida — o menu do topo voltou a mostrar suas iniciais."}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!file || busy}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5b4fcf] hover:bg-[#4f44b8] text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:hover:bg-[#5b4fcf] disabled:cursor-default"
      >
        <Upload size={14} /> {busy ? "Enviando…" : "Salvar foto"}
      </button>

      <div className="mt-4 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          A foto fica vinculada ao e-mail da sua conta e passa a aparecer no menu do topo.
          A prévia é local: nada sai daqui até você clicar em{" "}
          <strong className="font-medium text-foreground">Salvar foto</strong>. Sem foto,
          continuam valendo as iniciais do seu nome.
        </p>
      </div>
    </div>
  );
}
