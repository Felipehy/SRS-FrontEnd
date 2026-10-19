import { useEffect, useState } from "react";
import {
  Landmark, Loader2, RefreshCw, Info, AlertTriangle, Plus, Pencil, Trash2, Save, CheckCircle2, X,
  MapPin,
} from "lucide-react";
import { clsx } from "clsx";
import {
  departmentService, DEPARTMENT_NAME_MAX, type Department, type DepartmentPayload,
} from "../../../api/service/departmentService";
import { roomService, type RoomOption } from "../../../api/service/roomService";

type Errors = { name?: string; idRoom?: string };

function normalizeName(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

function validateName(value: string, taken: string[]): string | undefined {
  const t = normalizeName(value);
  if (!t) return "É necessário o nome do departamento";
  if (t.length < 2) return "Informe pelo menos 2 caracteres";
  if (t.length > DEPARTMENT_NAME_MAX) return `Máximo de ${DEPARTMENT_NAME_MAX} caracteres`;
  if (taken.includes(t.toLowerCase())) return "Já existe um departamento com esse nome";
  return undefined;
}

function validateRoom(value: string): string | undefined {
  if (!value) return "É necessário a sala";
  return undefined;
}

function takenNames(departments: Department[], ignoreId?: number): string[] {
  const nomes: string[] = [];
  for (const department of departments) {
    if (department.id !== ignoreId) nomes.push(department.name.trim().toLowerCase());
  }
  return nomes;
}

function roomLabel(room: RoomOption): string {
  if (room.isActive) return room.floor;
  return `${room.floor} · oculta nas reservas`;
}

function inputCls(err?: string): string {
  return clsx(
    "w-full bg-muted/50 border rounded-xl px-3 py-2.5 text-xs text-foreground outline-none transition-all placeholder-muted-foreground/50",
    err ? "border-red-300 bg-red-50 dark:bg-red-950/30" : "border-transparent focus:border-[#5b4fcf]/30 focus:bg-card"
  );
}

function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">{children}</label>;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p role="alert" className="text-[11px] text-red-500 mt-1">{msg}</p>;
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
      <p className="text-[11px] text-red-500">{msg}</p>
    </div>
  );
}

function NoRoomsHint() {
  return (
    <p className="text-[11px] text-muted-foreground mt-1">
      Nenhuma sala carregada — cadastre ou libere uma sala na aba Salas de reunião.
    </p>
  );
}

function ModalShell({ titleId, locked, onClose, children }: {
  titleId: string;
  locked: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !locked) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !locked) onClose(); }}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border max-h-[85vh] overflow-y-auto"
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        {children}
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

function CreateDepartmentForm({ rooms, taken, onCreated, onCancel }: {
  rooms: RoomOption[];
  taken: string[];
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [idRoom, setIdRoom] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function changeName(value: string) {
    setName(value);
    setErrors(prev => ({ ...prev, name: undefined }));
    setSubmitError(null);
  }

  function changeRoom(value: string) {
    setIdRoom(value);
    setErrors(prev => ({ ...prev, idRoom: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const found: Errors = {
      name: validateName(name, taken),
      idRoom: validateRoom(idRoom),
    };
    setErrors(found);
    if (found.name || found.idRoom) return;

    const payload: DepartmentPayload = { name: normalizeName(name), idRoom: Number(idRoom) };

    setSubmitting(true);
    setSubmitError(null);
    try {
      await departmentService.criar(payload);
      onCreated(payload.name);
    } catch (err: any) {
      const fieldErrors: Record<string, string> | undefined = err?.fieldErrors;
      const mapped: Errors = {};
      let restou = false;
      for (const [key, msg] of Object.entries(fieldErrors ?? {})) {
        if (key === "name" || key === "idRoom") {
          mapped[key] = String(msg);
        } else {
          restou = true;
        }
      }
      const hasMapped = Object.keys(mapped).length > 0;
      if (hasMapped) setErrors(mapped);
      if (!hasMapped || restou) {
        setSubmitError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível criar o departamento. Tente novamente.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="off" className="p-5 mb-4 bg-card rounded-2xl border border-border/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="dep-new-name">Nome do departamento *</FieldLabel>
          <input
            id="dep-new-name"
            autoFocus
            value={name}
            onChange={e => changeName(e.target.value)}
            onBlur={() => setErrors(prev => ({ ...prev, name: validateName(name, taken) }))}
            maxLength={DEPARTMENT_NAME_MAX}
            autoComplete="off"
            aria-invalid={!!errors.name}
            placeholder="Ex.: Divisão Administrativa"
            className={inputCls(errors.name)}
          />
          <FieldError msg={errors.name} />
        </div>

        <div>
          <FieldLabel htmlFor="dep-new-room">Sala *</FieldLabel>
          <select
            id="dep-new-room"
            value={idRoom}
            onChange={e => changeRoom(e.target.value)}
            onBlur={() => setErrors(prev => ({ ...prev, idRoom: validateRoom(idRoom) }))}
            disabled={rooms.length === 0}
            aria-invalid={!!errors.idRoom}
            className={clsx(inputCls(errors.idRoom), "disabled:opacity-50")}
          >
            <option value="">
              {rooms.length === 0 ? "Nenhuma sala disponível" : "Selecione uma sala…"}
            </option>
            {rooms.map(room => (
              <option key={room.id} value={String(room.id)}>{roomLabel(room)}</option>
            ))}
          </select>
          <FieldError msg={errors.idRoom} />
          {rooms.length === 0 && <NoRoomsHint />}
        </div>
      </div>

      {submitError && <ErrorBox msg={submitError} />}

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
        >
          <Plus size={13} /> {submitting ? "Criando…" : "Criar departamento"}
        </button>
      </div>
    </form>
  );
}

function EditDepartmentModal({ department, rooms, taken, onSaved, onClose }: {
  department: Department;
  rooms: RoomOption[];
  taken: string[];
  onSaved: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [idRoom, setIdRoom] = useState(department.idRoom ? String(department.idRoom) : "");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const unchanged =
    normalizeName(name) === department.name.trim() && Number(idRoom) === department.idRoom;

  function changeName(value: string) {
    setName(value);
    setErrors(prev => ({ ...prev, name: undefined }));
    setSubmitError(null);
  }

  function changeRoom(value: string) {
    setIdRoom(value);
    setErrors(prev => ({ ...prev, idRoom: undefined }));
    setSubmitError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const found: Errors = {
      name: validateName(name, taken),
      idRoom: validateRoom(idRoom),
    };
    setErrors(found);
    if (found.name || found.idRoom) return;

    const payload: DepartmentPayload = { name: normalizeName(name), idRoom: Number(idRoom) };

    setSubmitting(true);
    setSubmitError(null);
    try {
      await departmentService.atualizar(department.id, payload);
      onSaved(payload.name);
    } catch (err: any) {
      setSubmitError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível salvar o departamento. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell titleId="edit-dep-title" locked={submitting} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate autoComplete="off">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5b4fcf]/10 flex items-center justify-center flex-shrink-0">
            <Pencil size={15} className="text-[#5b4fcf]" />
          </div>
          <div className="min-w-0">
            <h3 id="edit-dep-title" className="text-base font-semibold text-foreground">Editar departamento</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              O nome passa a aparecer no cadastro dos usuários e nas telas de reserva.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <FieldLabel htmlFor="dep-name">Nome *</FieldLabel>
            <input
              id="dep-name"
              autoFocus
              value={name}
              onChange={e => changeName(e.target.value)}
              onBlur={() => setErrors(prev => ({ ...prev, name: validateName(name, taken) }))}
              maxLength={DEPARTMENT_NAME_MAX}
              autoComplete="off"
              aria-invalid={!!errors.name}
              className={inputCls(errors.name)}
            />
            <FieldError msg={errors.name} />
          </div>

          <div>
            <FieldLabel htmlFor="dep-room">Sala *</FieldLabel>
            <select
              id="dep-room"
              value={idRoom}
              onChange={e => changeRoom(e.target.value)}
              onBlur={() => setErrors(prev => ({ ...prev, idRoom: validateRoom(idRoom) }))}
              disabled={rooms.length === 0}
              aria-invalid={!!errors.idRoom}
              className={clsx(inputCls(errors.idRoom), "disabled:opacity-50")}
            >
              <option value="">
                {rooms.length === 0 ? "Nenhuma sala disponível" : "Selecione uma sala…"}
              </option>
              {rooms.map(room => (
                <option key={room.id} value={String(room.id)}>{roomLabel(room)}</option>
              ))}
            </select>
            <FieldError msg={errors.idRoom} />
            {rooms.length === 0 && <NoRoomsHint />}
          </div>
        </div>

        {submitError && <ErrorBox msg={submitError} />}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || unchanged}
            title={unchanged ? "Nenhuma alteração para salvar" : undefined}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
          >
            <Save size={13} /> {submitting ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteDepartmentModal({ department, onDeleted, onClose }: {
  department: Department;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await departmentService.excluir(department.id);
      onDeleted();
    } catch (err: any) {
      setError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível excluir o departamento. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell titleId="del-dep-title" locked={submitting} onClose={onClose}>
      <>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 id="del-dep-title" className="text-base font-semibold text-foreground">Excluir departamento</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              <strong className="font-semibold text-foreground">{department.name}</strong> sai da lista
              para todo mundo. Não há como desfazer.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2.5 mt-4 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
            Os usuários vinculados a este departamento ficam sem departamento e precisam ser
            realocados na aba Usuários.
          </p>
        </div>

        {error && <ErrorBox msg={error} />}

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
          >
            <Trash2 size={13} /> {submitting ? "Excluindo…" : "Excluir"}
          </button>
        </div>
      </>
    </ModalShell>
  );
}

type Notice = { kind: "created" | "updated" | "deleted"; name: string };

function NoticeBanner({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const neutral = notice.kind === "deleted";
  const Icon = neutral ? Trash2 : CheckCircle2;

  return (
    <div
      role="status"
      className={clsx(
        "flex items-start gap-2.5 mb-4 px-4 py-3 rounded-2xl border",
        neutral
          ? "border-border bg-muted/50"
          : "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30"
      )}
    >
      <Icon size={14} className={clsx("flex-shrink-0 mt-0.5", neutral ? "text-muted-foreground" : "text-green-600")} />

      <p className={clsx("text-xs leading-relaxed", neutral ? "text-muted-foreground" : "text-green-700 dark:text-green-400")}>
        {notice.kind === "created" && (
          <>
            O departamento <strong className="font-semibold">{notice.name}</strong> foi criado
            e já aparece na lista.
          </>
        )}
        {notice.kind === "updated" && (
          <>
            O departamento <strong className="font-semibold">{notice.name}</strong> foi atualizado.
          </>
        )}
        {notice.kind === "deleted" && (
          <>
            O departamento <strong className="font-semibold text-foreground">{notice.name}</strong> foi excluído.
          </>
        )}
      </p>

      <button
        onClick={onClose}
        aria-label="Fechar aviso"
        className={clsx(
          "ml-auto flex-shrink-0 transition-colors",
          neutral ? "text-muted-foreground/70 hover:text-foreground" : "text-green-600/70 hover:text-green-700"
        )}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export default function DepartmentsSection() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toEdit, setToEdit] = useState<Department | null>(null);
  const [toDelete, setToDelete] = useState<Department | null>(null);

  function carregar() {
    setLoading(true);
    setLoadError(null);
    roomService.listar().then(setRooms).catch(() => setRooms([]));
    departmentService.listar()
      .then(lista => setDepartments(lista))
      .catch((err: any) => setLoadError(err?.detail ?? err?.message ?? "Não foi possível carregar os departamentos."))
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  function handleCreated(name: string) {
    setNotice({ kind: "created", name });
    setFormOpen(false);
    carregar();
  }

  function handleSaved(name: string) {
    setNotice({ kind: "updated", name });
    setToEdit(null);
    carregar();
  }

  function handleDeleted(department: Department) {
    setNotice({ kind: "deleted", name: department.name });
    setToDelete(null);
    carregar();
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Departamentos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {loading
              ? "Departamentos usados no cadastro dos usuários e nas reservas."
              : `${departments.length} departamento${departments.length !== 1 ? "s" : ""} cadastrado${departments.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={carregar}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            <RefreshCw size={12} className={clsx(loading && "animate-spin")} /> Atualizar
          </button>
          {!formOpen && (
            <button
              onClick={() => { setFormOpen(true); setNotice(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={12} /> Novo departamento
            </button>
          )}
        </div>
      </div>

      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}

      {formOpen && (
        <CreateDepartmentForm
          rooms={rooms}
          taken={takenNames(departments)}
          onCreated={handleCreated}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {loadError ? (
        <div className="flex items-start gap-3 p-5 bg-card rounded-2xl border border-border/50">
          <AlertTriangle size={15} className="text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground">Erro ao carregar os departamentos</p>
            <p className="text-xs text-muted-foreground mt-0.5">{loadError}</p>
            <button onClick={carregar} className="text-xs text-[#5b4fcf] mt-2 hover:underline">Tentar de novo</button>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 p-5 bg-card rounded-2xl border border-border/50 text-xs text-muted-foreground">
          <Loader2 size={13} className="animate-spin" /> Carregando departamentos…
        </div>
      ) : departments.length === 0 ? (
        <div className="p-5 bg-card rounded-2xl border border-border/50">
          <p className="text-sm text-foreground">Nenhum departamento cadastrado</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use <strong className="font-medium text-foreground">Novo departamento</strong> para cadastrar o primeiro.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {departments.map(department => (
            <div
              key={department.id}
              className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border/50"
            >
              <div className="w-9 h-9 rounded-xl bg-[#5b4fcf]/10 flex items-center justify-center flex-shrink-0">
                <Landmark size={15} className="text-[#5b4fcf]" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug truncate">
                  {department.name}
                </p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <MapPin size={11} className="flex-shrink-0" />
                  <span className="truncate">{department.room || "Sem sala definida"}</span>
                </p>
              </div>

              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => { setNotice(null); setToEdit(department); }}
                  title={`Editar ${department.name}`}
                  aria-label={`Editar ${department.name}`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-[#5b4fcf] hover:bg-[#5b4fcf]/10 transition-colors"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => { setNotice(null); setToDelete(department); }}
                  title={`Excluir ${department.name}`}
                  aria-label={`Excluir ${department.name}`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Info size={13} className="flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          Cada mudança é salva no servidor na hora e vale para todos os usuários. O departamento de
          cada pessoa é definido na aba Usuários.
        </p>
      </div>

      {toEdit && (
        <EditDepartmentModal
          key={`edit-${toEdit.id}`}
          department={toEdit}
          rooms={rooms}
          taken={takenNames(departments, toEdit.id)}
          onSaved={handleSaved}
          onClose={() => setToEdit(null)}
        />
      )}

      {toDelete && (
        <DeleteDepartmentModal
          department={toDelete}
          onDeleted={() => handleDeleted(toDelete)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
