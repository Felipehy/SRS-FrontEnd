import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserPlus, CheckCircle2, Search, X, RefreshCw, AlertTriangle, Users as UsersIcon,
  ChevronLeft, ChevronRight, Trash2, Pencil, Save, UsersRound, UserMinus, KeyRound, Landmark, ShieldCheck,
} from "lucide-react";
import { clsx } from "clsx";
import {
  createUser, deleteUser, listUsers, resetMFA, resetPassword, setUserDepartment, updateUser,
  type AppUser, type CreateUser, type UserStatus,
} from "../../../api/service/userService";
import { departmentService, type Department } from "../../../api/service/departmentService";
import {
  addUserToGroup, groupColorOf, listGroups, listGroupsForUser, removeUserFromGroup, type AppGroup,
} from "../../../api/service/groupService";
import { userImageUrl } from "../../../api/service/efsService";
import { roleFromGroup } from "../../auth/albAuth";
import { useAuth } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import { RolePill, fallbackLabel } from "./RolePill";

const NAME_RE  = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

const NAME_MAX  = 60;
const EMAIL_MAX = 254;
const PHONE_MAX_DIGITS = 11;

const PAGE_SIZE = 10;

function onlyDigits(v: string): string {
  return v.replace(/\D/g, "");
}

function normalizeName(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

function maskPhone(v: string): string {
  const d = onlyDigits(v).slice(0, PHONE_MAX_DIGITS);
  if (d.length === 0) return "";
  if (d.length <= 2) return "(" + d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function validateName(value: string, msgVazio: string): string | undefined {
  const t = normalizeName(value);
  if (!t) return msgVazio;
  if (t.length < 2) return "Informe pelo menos 2 caracteres";
  if (t.length > NAME_MAX) return `Máximo de ${NAME_MAX} caracteres`;
  if (!NAME_RE.test(t)) return "Use apenas letras, espaço, hífen e apóstrofo";
  return undefined;
}

function validateEmail(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "É necessário o email";
  if (t.length > EMAIL_MAX) return `Máximo de ${EMAIL_MAX} caracteres`;
  if (!EMAIL_RE.test(t)) return "E-mail inválido";
  return undefined;
}

function validatePhone(value: string): string | undefined {
  const d = onlyDigits(value);
  if (!d) return undefined;
  if (d.length > PHONE_MAX_DIGITS) return "Número inválido";
  if (d.length < 10) return "Telefone incompleto — informe DDD + número";
  if (d[0] === "0" || d[1] === "0") return "DDD inválido";
  if (d.length === 11 && d[2] !== "9") return "Celular de 11 dígitos deve começar com 9 depois do DDD";
  return undefined;
}

type Form = { givenName: string; familyName: string; email: string; phoneNumber: string; idDepartment: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY_FORM: Form = { givenName: "", familyName: "", email: "", phoneNumber: "", idDepartment: "" };

function validateDepartment(value: string): string | undefined {
  if (!value) return "É necessário o departamento";
  return undefined;
}

function validateField(k: keyof Form, value: string): string | undefined {
  if (k === "givenName") return validateName(value, "É necessário o primeiro nome");
  if (k === "familyName") return validateName(value, "É necessário o sobrenome");
  if (k === "email") return validateEmail(value);
  if (k === "idDepartment") return validateDepartment(value);
  return validatePhone(value);
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

const STATUS_CONFIG: Record<UserStatus, { label: string; cls: string }> = {
  CONFIRMED:             { label: "Ativo",             cls: "text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" },
  FORCE_CHANGE_PASSWORD: { label: "Senha provisória",  cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
  UNCONFIRMED:           { label: "Não confirmado",    cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
  RESET_REQUIRED:        { label: "Redefinir senha",   cls: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800" },
  ARCHIVED:              { label: "Arquivado",         cls: "text-muted-foreground bg-muted border-border" },
  COMPROMISED:           { label: "Comprometido",      cls: "text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" },
  UNKNOWN:               { label: "Indefinido",        cls: "text-muted-foreground bg-muted border-border" },
};

function StatusPill({ status }: { status: UserStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={clsx("inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function fullName(u: AppUser): string {
  return [u.givenName, u.familyName].filter(Boolean).join(" ");
}

function initialsOf(u: AppUser): string {
  const ini = (u.givenName[0] ?? "") + (u.familyName[0] ?? "");
  if (ini) return ini.toUpperCase();
  return (u.email[0] ?? "?").toUpperCase();
}

function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push("…");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < total - 1) out.push("…");
  out.push(total);
  return out;
}

function Pager({ page, totalPages, onChange }: {
  page: number; totalPages: number; onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;

  const cell = "w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors";
  const arrow = clsx(cell, "border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground disabled:cursor-default");

  return (
    <nav className="flex items-center gap-1" aria-label="Paginação dos usuários">
      <button onClick={() => onChange(page - 1)} disabled={page === 1} aria-label="Página anterior" className={arrow}>
        <ChevronLeft size={13} />
      </button>

      {pageWindow(page, totalPages).map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className={clsx(cell, "text-muted-foreground")}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            aria-current={p === page ? "page" : undefined}
            aria-label={`Página ${p}`}
            className={clsx(cell, p === page ? "bg-[#5b4fcf] text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
          >
            {p}
          </button>
        )
      )}

      <button onClick={() => onChange(page + 1)} disabled={page === totalPages} aria-label="Próxima página" className={arrow}>
        <ChevronRight size={13} />
      </button>
    </nav>
  );
}

function EmptyState({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children?: React.ReactNode;
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

function CreateUserForm({ departments, onCreated, onCancel }: {
  departments: Department[];
  onCreated: (user: { name: string; email: string }) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (k: keyof Form, value: string) => {
    setF(prev => ({ ...prev, [k]: value }));
    setErrors(prev => ({ ...prev, [k]: undefined }));
    setSubmitError(null);
  };

  const handleBlur = (k: keyof Form) => {
    setErrors(prev => ({ ...prev, [k]: validateField(k, f[k]) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found: Errors = {
      givenName: validateField("givenName", f.givenName),
      familyName: validateField("familyName", f.familyName),
      email: validateField("email", f.email),
      phoneNumber: validateField("phoneNumber", f.phoneNumber),
      idDepartment: departments.length === 0 ? undefined : validateField("idDepartment", f.idDepartment),
    };
    setErrors(found);
    if (found.givenName || found.familyName || found.email || found.phoneNumber || found.idDepartment) return;

    const phone = onlyDigits(f.phoneNumber);
    const payload: CreateUser = {
      givenName: normalizeName(f.givenName),
      familyName: normalizeName(f.familyName),
      email: f.email.trim(),
    };
    if (phone) payload.phoneNumber = phone;
    if (f.idDepartment) payload.idDepartment = Number(f.idDepartment);

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createUser(payload);
      onCreated({ name: `${payload.givenName} ${payload.familyName}`, email: payload.email });
    } catch (err: any) {
      const fieldErrors: Record<string, string> | undefined = err?.fieldErrors;
      const mapped: Errors = {};
      let restou = false;
      for (const [key, msg] of Object.entries(fieldErrors ?? {})) {
        if (key === "givenName" || key === "familyName" || key === "email" || key === "phoneNumber" || key === "idDepartment") {
          mapped[key] = String(msg);
        } else {
          restou = true;
        }
      }
      const hasMapped = Object.keys(mapped).length > 0;
      if (hasMapped) setErrors(mapped);
      if (!hasMapped || restou) {
        setSubmitError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível cadastrar o usuário. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4 p-5 mb-4 bg-card rounded-2xl border border-border/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="u-given">Primeiro nome *</FieldLabel>
          <input
            id="u-given"
            autoFocus
            value={f.givenName}
            onChange={e => handleChange("givenName", e.target.value)}
            onBlur={() => handleBlur("givenName")}
            maxLength={NAME_MAX}
            autoComplete="off"
            aria-invalid={!!errors.givenName}
            placeholder="Ex.: Maria"
            className={inputCls(errors.givenName)}
          />
          <FieldError msg={errors.givenName} />
        </div>
        <div>
          <FieldLabel htmlFor="u-family">Sobrenome *</FieldLabel>
          <input
            id="u-family"
            value={f.familyName}
            onChange={e => handleChange("familyName", e.target.value)}
            onBlur={() => handleBlur("familyName")}
            maxLength={NAME_MAX}
            autoComplete="off"
            aria-invalid={!!errors.familyName}
            placeholder="Ex.: Silva"
            className={inputCls(errors.familyName)}
          />
          <FieldError msg={errors.familyName} />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="u-email">E-mail *</FieldLabel>
        <input
          id="u-email"
          type="email"
          value={f.email}
          onChange={e => handleChange("email", e.target.value)}
          onBlur={() => handleBlur("email")}
          maxLength={EMAIL_MAX}
          autoComplete="off"
          aria-invalid={!!errors.email}
          placeholder="nome.sobrenome@example.com"
          className={inputCls(errors.email)}
        />
        <FieldError msg={errors.email} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="u-phone">Telefone (opcional)</FieldLabel>
          <input
            id="u-phone"
            type="tel"
            inputMode="numeric"
            value={f.phoneNumber}
            onChange={e => handleChange("phoneNumber", maskPhone(e.target.value))}
            onBlur={() => handleBlur("phoneNumber")}
            maxLength={15}
            autoComplete="off"
            aria-invalid={!!errors.phoneNumber}
            placeholder="(00) 00000-0000"
            className={inputCls(errors.phoneNumber)}
          />
          <FieldError msg={errors.phoneNumber} />
        </div>

        <div>
          <FieldLabel htmlFor="u-department">{departments.length === 0 ? "Departamento" : "Departamento *"}</FieldLabel>
          <select
            id="u-department"
            value={f.idDepartment}
            onChange={e => handleChange("idDepartment", e.target.value)}
            onBlur={() => handleBlur("idDepartment")}
            disabled={departments.length === 0}
            aria-invalid={!!errors.idDepartment}
            className={clsx(inputCls(errors.idDepartment), "disabled:opacity-50")}
          >
            <option value="">
              {departments.length === 0 ? "Nenhum departamento cadastrado" : "Selecione um departamento…"}
            </option>
            {departments.map(department => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          <FieldError msg={errors.idDepartment} />
          {departments.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Cadastre um departamento na aba Departamentos para vincular o usuário.
            </p>
          )}
        </div>
      </div>

      {submitError && (
        <div role="alert" className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
          <p className="text-[11px] text-red-500">{submitError}</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
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
          <UserPlus size={13} /> {submitting ? "Cadastrando…" : "Cadastrar usuário"}
        </button>
      </div>
    </form>
  );
}

function EditUserModal({ user, onSaved, onClose }: {
  user: AppUser;
  onSaved: (name: string) => void;
  onClose: () => void;
}) {
  const [givenName, setGivenName] = useState(user.givenName);
  const [familyName, setFamilyName] = useState(user.familyName);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const changeGivenName = (value: string) => {
    setGivenName(value);
    setErrors(prev => ({ ...prev, givenName: undefined }));
    setSubmitError(null);
  };

  const changeFamilyName = (value: string) => {
    setFamilyName(value);
    setErrors(prev => ({ ...prev, familyName: undefined }));
    setSubmitError(null);
  };

  const unchanged =
    normalizeName(givenName) === user.givenName && normalizeName(familyName) === user.familyName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const found: Errors = {
      givenName: validateField("givenName", givenName),
      familyName: validateField("familyName", familyName),
    };
    setErrors(found);
    if (found.givenName || found.familyName) return;

    const newGivenName = normalizeName(givenName);
    const newFamilyName = normalizeName(familyName);

    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateUser({
        email: user.email,
        givenName: newGivenName,
        familyName: newFamilyName,
        idDepartment: user.idDepartment,
      });
      onSaved(`${newGivenName} ${newFamilyName}`);
    } catch (err: any) {
      const fieldErrors: Record<string, string> | undefined = err?.fieldErrors;
      const mapped: Errors = {};
      let restou = false;
      for (const [key, msg] of Object.entries(fieldErrors ?? {})) {
        if (key === "givenName" || key === "familyName") {
          mapped[key] = String(msg);
        } else {
          restou = true;
        }
      }
      const hasMapped = Object.keys(mapped).length > 0;
      if (hasMapped) setErrors(mapped);
      if (!hasMapped || restou) {
        setSubmitError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível salvar as alterações. Tente novamente.");
      }
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        autoComplete="off"
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border"
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5b4fcf]/10 flex items-center justify-center flex-shrink-0">
            <Pencil size={15} className="text-[#5b4fcf]" />
          </div>
          <div className="min-w-0">
            <h3 id="edit-user-title" className="text-base font-semibold text-foreground">Editar nome</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Altere o primeiro nome e o sobrenome. O e-mail identifica o cadastro e não muda por aqui.
            </p>
          </div>
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">E-mail</p>
          <p className="text-xs text-foreground font-mono mt-0.5 break-all">{user.email || "—"}</p>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <FieldLabel htmlFor="e-given">Primeiro nome *</FieldLabel>
            <input
              id="e-given"
              autoFocus
              value={givenName}
              onChange={e => changeGivenName(e.target.value)}
              onBlur={() => setErrors(prev => ({ ...prev, givenName: validateField("givenName", givenName) }))}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={!!errors.givenName}
              placeholder="Ex.: Maria"
              className={inputCls(errors.givenName)}
            />
            <FieldError msg={errors.givenName} />
          </div>
          <div>
            <FieldLabel htmlFor="e-family">Sobrenome *</FieldLabel>
            <input
              id="e-family"
              value={familyName}
              onChange={e => changeFamilyName(e.target.value)}
              onBlur={() => setErrors(prev => ({ ...prev, familyName: validateField("familyName", familyName) }))}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={!!errors.familyName}
              placeholder="Ex.: Silva"
              className={inputCls(errors.familyName)}
            />
            <FieldError msg={errors.familyName} />
          </div>
        </div>

        {submitError && (
          <div role="alert" className="flex items-start gap-2.5 mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
            <p className="text-[11px] text-red-500">{submitError}</p>
          </div>
        )}

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

      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

function DeleteUserModal({ user, onDeleted, onClose }: {
  user: AppUser;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const handleDelete = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await deleteUser(user.email);
      onDeleted();
    } catch (err: any) {
      setError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível excluir o usuário. Tente novamente.");
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="del-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border"
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 id="del-user-title" className="text-base font-semibold text-foreground">Excluir usuário</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              <strong className="font-semibold text-foreground">{fullName(user) || user.email}</strong>{" "}
              perde o acesso ao sistema na hora. Não há como desfazer.
            </p>
          </div>
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">E-mail</p>
          <p className="text-xs text-foreground font-mono mt-0.5 break-all">{user.email || "—"}</p>
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
            <p className="text-[11px] text-red-500">{error}</p>
          </div>
        )}

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
            <Trash2 size={13} /> {submitting ? "Excluindo…" : "Excluir usuário"}
          </button>
        </div>
      </div>

      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

type ResetKind = "password" | "mfa";

function ResetPasswordModal({ user, isMe, onDone, onClose }: {
  user: AppUser;
  isMe: boolean;
  onDone: (kind: ResetKind) => void;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState<ResetKind | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const handleResetPassword = async () => {
    setSubmitting("password");
    setPasswordError(null);
    setMfaError(null);
    try {
      await resetPassword(user.email);
      onDone("password");
    } catch (err: any) {
      setPasswordError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível redefinir a senha. Tente novamente.");
      setSubmitting(null);
    }
  };

  const handleResetMFA = async () => {
    setSubmitting("mfa");
    setPasswordError(null);
    setMfaError(null);
    try {
      await resetMFA(user.email);
      onDone("mfa");
    } catch (err: any) {
      setMfaError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível redefinir o MFA. Tente novamente.");
      setSubmitting(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border max-h-[90vh] overflow-y-auto"
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center flex-shrink-0">
            <KeyRound size={15} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <h3 id="reset-user-title" className="text-base font-semibold text-foreground">Redefinir acesso</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Escolha o que redefinir para{" "}
              <strong className="font-semibold text-foreground">{fullName(user) || user.email}</strong>.
              Avise a pessoa antes de continuar.
            </p>
          </div>
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">E-mail</p>
          <p className="text-xs text-foreground font-mono mt-0.5 break-all">{user.email || "—"}</p>
        </div>

        <div className="mt-3 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <KeyRound size={13} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-foreground">Senha</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            Volta para a senha provisória padrão e cria uma nova no primeiro acesso.
            A senha atual deixa de funcionar na hora.
          </p>

          {isMe && (
            <div className="flex items-start gap-2.5 mt-2.5 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Esta é a sua própria conta. No próximo acesso você entra com a senha provisória padrão
                e define uma nova.
              </p>
            </div>
          )}

          {passwordError && (
            <div role="alert" className="flex items-start gap-2.5 mt-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
              <p className="text-[11px] text-red-500">{passwordError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={!!submitting}
            className="w-full flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
          >
            <KeyRound size={13} /> {submitting === "password" ? "Redefinindo…" : "Redefinir senha"}
          </button>
        </div>

        <div className="mt-3 p-3 rounded-xl border border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs font-semibold text-foreground">MFA</p>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
            O autenticador vinculado à conta deixa de valer na hora. No próximo acesso a pessoa
            configura o MFA de novo. Use quando ela trocou ou perdeu o celular.
          </p>

          {isMe && (
            <div className="flex items-start gap-2.5 mt-2.5 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                Esta é a sua própria conta. No próximo acesso você configura o MFA de novo.
              </p>
            </div>
          )}

          {mfaError && (
            <div role="alert" className="flex items-start gap-2.5 mt-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
              <p className="text-[11px] text-red-500">{mfaError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleResetMFA}
            disabled={!!submitting}
            className="w-full flex items-center justify-center gap-2 mt-3 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
          >
            <ShieldCheck size={13} /> {submitting === "mfa" ? "Redefinindo…" : "Redefinir MFA"}
          </button>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            disabled={!!submitting}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            Cancelar
          </button>
        </div>
      </div>

      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

function ChangeDepartmentModal({ user, atual, departments, onSaved, onClose }: {
  user: AppUser;
  atual?: Department;
  departments: Department[];
  onSaved: (departmentName: string) => void;
  onClose: () => void;
}) {
  const [pick, setPick] = useState(user.idDepartment ? String(user.idDepartment) : "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onClose]);

  const escolhido = departments.find(d => String(d.id) === pick);
  const unchanged = !escolhido || escolhido.id === user.idDepartment;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escolhido) return;

    setSubmitting(true);
    setError(null);
    try {
      await setUserDepartment({ email: user.email, idDepartment: escolhido.id });
      onSaved(escolhido.name);
    } catch (err: any) {
      setError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível alterar o departamento. Tente novamente.");
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dep-user-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-card rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-border"
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#5b4fcf]/10 flex items-center justify-center flex-shrink-0">
            <Landmark size={15} className="text-[#5b4fcf]" />
          </div>
          <div className="min-w-0">
            <h3 id="dep-user-title" className="text-base font-semibold text-foreground">Alterar departamento</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Define a qual departamento{" "}
              <strong className="font-semibold text-foreground">{fullName(user) || user.email}</strong>{" "}
              pertence. Vale a partir das próximas reservas.
            </p>
          </div>
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Departamento atual</p>
          <p className="text-xs text-foreground mt-0.5 break-words">{atual?.name ?? "Sem departamento"}</p>
        </div>

        <div className="mt-4">
          <FieldLabel htmlFor="dep-pick">Novo departamento</FieldLabel>
          <select
            id="dep-pick"
            autoFocus
            value={pick}
            onChange={e => { setPick(e.target.value); setError(null); }}
            disabled={submitting || departments.length === 0}
            className={clsx(inputCls(), "disabled:opacity-50")}
          >
            <option value="">
              {departments.length === 0 ? "Nenhum departamento cadastrado" : "Selecione um departamento…"}
            </option>
            {departments.map(department => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          {departments.length === 0 && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Cadastre um departamento na aba Departamentos para vincular o usuário.
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 mt-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
            <p className="text-[11px] text-red-500">{error}</p>
          </div>
        )}

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
            title={unchanged ? "Escolha um departamento diferente do atual" : undefined}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
          >
            <Save size={13} /> {submitting ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>

      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

type UserGroupsState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; groups: AppGroup[] };

function UserGroupsModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [state, setState] = useState<UserGroupsState>({ kind: "loading" });
  const [allGroups, setAllGroups] = useState<AppGroup[]>([]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", groups: await listGroupsForUser(user) });
    } catch (err: any) {
      setState({ kind: "error", message: err?.detail ?? err?.title ?? err?.message ?? "Não foi possível carregar os grupos do usuário." });
    }
  }, [user]);

  useEffect(() => {
    load();
    listGroups().then(setAllGroups).catch(() => setAllGroups([]));
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const groups = state.kind === "ready" ? state.groups : [];
  const joined = useMemo(() => new Set(groups.map(g => g.groupCognito.toLowerCase())), [groups]);

  const candidates = useMemo(
    () => allGroups
      .filter(g => !joined.has(g.groupCognito.toLowerCase()))
      .sort((a, b) => a.groupName.localeCompare(b.groupName, "pt-BR")),
    [allGroups, joined]
  );

  const pickedGroup = allGroups.find(g => g.groupCognito === pick);

  const run = async (groupName: string, op: () => Promise<string>, fallback: string) => {
    setBusy(groupName);
    setActionError(null);
    setFeedback(null);
    try {
      const message = await op();
      setFeedback(message || fallback);
      setPick("");
      await load();
    } catch (err: any) {
      setActionError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível concluir. Tente novamente.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-groups-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(0.6px)" }}
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div
        className="bg-card rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-border max-h-[85vh] overflow-y-auto"
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-[#5b4fcf]/10 flex items-center justify-center flex-shrink-0">
            <UsersRound size={15} className="text-[#5b4fcf]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="user-groups-title" className="text-base font-semibold text-foreground truncate">
              Grupos de {fullName(user) || user.email}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 font-mono break-all">{user.email || "—"}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <FieldLabel htmlFor="ug-add">Adicionar a um grupo</FieldLabel>
            <select
              id="ug-add"
              value={pick}
              onChange={e => setPick(e.target.value)}
              disabled={!!busy || candidates.length === 0}
              className={clsx(inputCls(), "disabled:opacity-50")}
            >
              <option value="">
                {candidates.length === 0 ? "Nenhum grupo disponível" : "Selecione um grupo…"}
              </option>
              {candidates.map(g => (
                <option key={g.groupCognito} value={g.groupCognito}>
                  {g.groupName}{g.description ? ` — ${g.description}` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => run(pick, () => addUserToGroup({ username: user.username, group: pick }), `Entrou no grupo ${pickedGroup?.groupName ?? pick}.`)}
            disabled={!pick || !!busy}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-default flex-shrink-0"
          >
            <UserPlus size={13} /> {busy && busy === pick ? "Adicionando…" : "Adicionar"}
          </button>
        </div>

        {feedback && (
          <div role="status" className="flex items-start gap-2.5 mb-3 px-3 py-2.5 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30">
            <CheckCircle2 size={13} className="text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-green-700 dark:text-green-400 leading-relaxed">{feedback}</p>
          </div>
        )}

        {actionError && (
          <div role="alert" className="flex items-start gap-2.5 mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
            <p className="text-[11px] text-red-500">{actionError}</p>
          </div>
        )}

        {state.kind === "loading" && (
          <div className="space-y-2">
            {[0, 1].map(i => <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />)}
          </div>
        )}

        {state.kind === "error" && (
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-red-500 leading-relaxed">
              <p>{state.message}</p>
              <button onClick={load} className="mt-2 px-2.5 py-1 rounded-lg bg-red-600 text-white font-medium hover:opacity-90 transition-opacity">
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {state.kind === "ready" && groups.length === 0 && (
          <div className="text-center px-4 py-8 rounded-xl border border-border/50 bg-muted/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Não está em nenhum grupo.{" "}
              Entra no sistema sem perfil para escolher, com o acesso padrão de{" "}
              <strong className="font-medium text-foreground">{fallbackLabel}</strong>.
            </p>
          </div>
        )}

        {state.kind === "ready" && groups.length > 0 && (
          <div className="space-y-2">
            {groups.map(g => (
              <div
                key={g.groupCognito}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/30 border-l-4"
                style={{ borderLeftColor: groupColorOf(g) }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: groupColorOf(g) }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{g.groupName}</p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{g.groupCognito}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{g.description ?? "Sem descrição"}</p>
                </div>
                <RolePill role={roleFromGroup(g.groupCognito)} groupName={g.groupCognito} />
                <button
                  onClick={() => run(g.groupCognito, () => removeUserFromGroup({ username: user.username, group: g.groupCognito }), `Saiu do grupo ${g.groupName}.`)}
                  disabled={!!busy}
                  title={`Tirar do grupo ${g.groupName}`}
                  aria-label={`Tirar do grupo ${g.groupName}`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default flex-shrink-0"
                >
                  <UserMinus size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

type Notice = {
  kind: "created" | "updated" | "deleted" | "reset" | "mfa" | "department";
  name: string;
  email: string;
  department?: string;
};

const NOTICE_CONFIG: Record<Notice["kind"], { icon: React.ElementType; iconCls: string; box: string; text: string; close: string }> = {
  created: {
    icon: CheckCircle2,
    iconCls: "text-green-600",
    box: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-400",
    close: "text-green-600/70 hover:text-green-700",
  },
  updated: {
    icon: CheckCircle2,
    iconCls: "text-green-600",
    box: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-400",
    close: "text-green-600/70 hover:text-green-700",
  },
  deleted: {
    icon: Trash2,
    iconCls: "text-muted-foreground",
    box: "border-border bg-muted/50",
    text: "text-muted-foreground",
    close: "text-muted-foreground/70 hover:text-foreground",
  },
  reset: {
    icon: KeyRound,
    iconCls: "text-amber-600",
    box: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    close: "text-amber-600/70 hover:text-amber-700",
  },
  mfa: {
    icon: ShieldCheck,
    iconCls: "text-amber-600",
    box: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    close: "text-amber-600/70 hover:text-amber-700",
  },
  department: {
    icon: Landmark,
    iconCls: "text-green-600",
    box: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30",
    text: "text-green-700 dark:text-green-400",
    close: "text-green-600/70 hover:text-green-700",
  },
};

function NoticeBanner({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const cfg = NOTICE_CONFIG[notice.kind];
  const Icon = cfg.icon;
  return (
    <div role="status" className={clsx("flex items-start gap-2.5 mb-4 px-4 py-3 rounded-2xl border", cfg.box)}>
      <Icon size={14} className={clsx("flex-shrink-0 mt-0.5", cfg.iconCls)} />

      <p className={clsx("text-xs leading-relaxed", cfg.text)}>
        {notice.kind === "created" && (
          <>
            <strong className="font-semibold">{notice.name}</strong> foi cadastrado
            com o e-mail <span className="font-mono">{notice.email}</span> e já aparece na lista.
          </>
        )}
        {notice.kind === "updated" && (
          <>
            O cadastro de <span className="font-mono">{notice.email}</span> foi atualizado
            para <strong className="font-semibold">{notice.name}</strong>.
          </>
        )}
        {notice.kind === "deleted" && (
          <>
            <strong className="font-semibold text-foreground">{notice.name}</strong> foi
            excluído <span className="font-mono">({notice.email})</span> e não tem mais acesso ao sistema.
          </>
        )}
        {notice.kind === "reset" && (
          <>
            <strong className="font-semibold">{notice.name}</strong>{" "}
            (<span className="font-mono">{notice.email}</span>) voltou para a senha provisória padrão
            e vai definir uma nova no primeiro acesso.
          </>
        )}
        {notice.kind === "mfa" && (
          <>
            <strong className="font-semibold">{notice.name}</strong>{" "}
            (<span className="font-mono">{notice.email}</span>) teve o MFA redefinido
            e vai configurar de novo no próximo acesso.
          </>
        )}
        {notice.kind === "department" && (
          <>
            <strong className="font-semibold">{notice.name}</strong> agora pertence ao departamento{" "}
            <strong className="font-semibold">{notice.department}</strong>.
          </>
        )}
      </p>

      <button
        onClick={onClose}
        aria-label="Fechar aviso"
        className={clsx("ml-auto transition-colors flex-shrink-0", cfg.close)}
      >
        <X size={12} />
      </button>
    </div>
  );
}

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; users: AppUser[] };

export default function UsersSection() {
  const { user: me } = useAuth();
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toDelete, setToDelete] = useState<AppUser | null>(null);
  const [toEdit, setToEdit] = useState<AppUser | null>(null);
  const [toGroups, setToGroups] = useState<AppUser | null>(null);
  const [toReset, setToReset] = useState<AppUser | null>(null);
  const [toDepartment, setToDepartment] = useState<AppUser | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);

  const myEmail = me?.email?.trim().toLowerCase() ?? "";

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    departmentService.listar().then(setDepartments).catch(() => setDepartments([]));
    try {
      const users = await listUsers();
      setState({ kind: "ready", users });
    } catch (err: any) {
      setState({ kind: "error", message: err?.detail ?? err?.title ?? err?.message ?? "Não foi possível carregar os usuários." });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const users = state.kind === "ready" ? state.users : [];

  const departmentById = useMemo(() => {
    const map = new Map<number, Department>();
    for (const department of departments) map.set(department.id, department);
    return map;
  }, [departments]);

  const departmentNameOf = useCallback((u: AppUser) => {
    if (!u.idDepartment) return "";
    return departmentById.get(u.idDepartment)?.name ?? "";
  }, [departmentById]);

  const sorted = useMemo(
    () => [...users].sort((a, b) => fullName(a).localeCompare(fullName(b), "pt-BR")),
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(u =>
      [fullName(u), u.email, u.phoneNumber, departmentNameOf(u)].some(v => v?.toLowerCase().includes(q))
    );
  }, [sorted, search, departmentNameOf]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const firstIndex = (current - 1) * PAGE_SIZE;
  const pageUsers = filtered.slice(firstIndex, firstIndex + PAGE_SIZE);

  const handleCreated = (user: { name: string; email: string }) => {
    setNotice({ kind: "created", ...user });
    setFormOpen(false);
    setPage(1);
    load();
  };

  const handleSaved = (user: AppUser, name: string) => {
    setNotice({ kind: "updated", name, email: user.email });
    setToEdit(null);
    load();
  };

  const handleDeleted = (user: AppUser) => {
    setNotice({ kind: "deleted", name: fullName(user) || user.email, email: user.email });
    setToDelete(null);
    load();
  };

  const handleReset = (user: AppUser, kind: ResetKind) => {
    if (kind === "mfa") {
      setNotice({ kind: "mfa", name: fullName(user) || user.email, email: user.email });
    } else {
      setNotice({ kind: "reset", name: fullName(user) || user.email, email: user.email });
    }
    setToReset(null);
    load();
  };

  const handleDepartment = (user: AppUser, department: string) => {
    setNotice({ kind: "department", name: fullName(user) || user.email, email: user.email, department });
    setToDepartment(null);
    load();
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Usuários</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state.kind === "ready"
              ? `${users.length} usuário${users.length !== 1 ? "s" : ""} cadastrado${users.length !== 1 ? "s" : ""}`
              : "Usuários com acesso ao sistema."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={load}
            disabled={state.kind === "loading"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            <RefreshCw size={12} className={clsx(state.kind === "loading" && "animate-spin")} /> Atualizar
          </button>
          {!formOpen && (
            <button
              onClick={() => { setFormOpen(true); setNotice(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity"
            >
              <UserPlus size={12} /> Novo usuário
            </button>
          )}
        </div>
      </div>

      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}

      {formOpen && (
        <CreateUserForm
          departments={departments}
          onCreated={handleCreated}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {state.kind === "ready" && users.length > 1 && (
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 mb-3">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, telefone ou departamento…"
            className="bg-transparent text-xs text-foreground placeholder-muted-foreground outline-none flex-1"
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Limpar busca" className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={11} />
            </button>
          )}
        </div>
      )}

      {state.kind === "loading" && (
        <div className="space-y-2">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-card rounded-2xl border border-border/50 animate-pulse" />
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar os usuários">
          <p>{state.message}</p>
          <button onClick={load} className="mt-3 px-3 py-1.5 rounded-lg bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity">
            Tentar novamente
          </button>
        </EmptyState>
      )}

      {state.kind === "ready" && users.length === 0 && (
        <EmptyState icon={UsersIcon} title="Nenhum usuário cadastrado">
          Use <strong className="font-medium text-foreground">Novo usuário</strong> para cadastrar o primeiro.
        </EmptyState>
      )}

      {state.kind === "ready" && users.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} title="Nenhum usuário encontrado">
          Nenhum cadastro corresponde à busca.
        </EmptyState>
      )}

      {state.kind === "ready" && filtered.length > 0 && (
        <div className="space-y-2">
          {pageUsers.map(u => {
            const isMe = !!myEmail && u.email.trim().toLowerCase() === myEmail;
            const label = fullName(u) || u.email || "usuário sem nome";
            const department = u.idDepartment ? departmentById.get(u.idDepartment) : undefined;
            return (
              <div key={u.username || u.email} className="flex items-center gap-3.5 p-3.5 bg-card rounded-2xl border border-border/50">
                <UserAvatar
                  name={fullName(u) || u.email}
                  initials={initialsOf(u)}
                  pictureUrl={userImageUrl(u.email) || undefined}
                  className="w-9 h-9 bg-[#5b4fcf]/10"
                  textClassName="text-[#5b4fcf]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug truncate">
                    {fullName(u) || "— sem nome no cadastro"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
                    <span className="truncate">{u.email || "—"}</span>
                    {u.phoneNumber && <><span>·</span><span>{maskPhone(u.phoneNumber)}</span></>}
                    {department && <><span>·</span><span className="truncate">{department.name}</span></>}
                  </div>
                </div>
                <StatusPill status={u.status} />

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => { setNotice(null); setToGroups(u); }}
                    disabled={!u.username}
                    title={u.username ? `Grupos de ${label}` : "Cadastro sem username — não é possível ver os grupos por aqui"}
                    aria-label={`Grupos de ${label}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-[#5b4fcf] hover:bg-[#5b4fcf]/10 transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <UsersRound size={14} />
                  </button>

                  <button
                    onClick={() => { setNotice(null); setToDepartment(u); }}
                    disabled={!u.email}
                    title={u.email ? `Departamento de ${label}` : "Cadastro sem e-mail — não é possível alterar o departamento por aqui"}
                    aria-label={`Departamento de ${label}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-[#5b4fcf] hover:bg-[#5b4fcf]/10 transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <Landmark size={14} />
                  </button>

                  <button
                    onClick={() => { setNotice(null); setToEdit(u); }}
                    disabled={!u.email}
                    title={u.email ? `Editar ${label}` : "Cadastro sem e-mail — não é possível editar por aqui"}
                    aria-label={`Editar ${label}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-[#5b4fcf] hover:bg-[#5b4fcf]/10 transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <Pencil size={14} />
                  </button>

                  <button
                    onClick={() => { setNotice(null); setToReset(u); }}
                    disabled={!u.email}
                    title={u.email ? `Redefinir senha ou MFA de ${label}` : "Cadastro sem e-mail — não é possível redefinir a senha ou o MFA por aqui"}
                    aria-label={`Redefinir senha ou MFA de ${label}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <KeyRound size={14} />
                  </button>

                  <button
                    onClick={() => { setNotice(null); setToDelete(u); }}
                    disabled={isMe || !u.email}
                    title={
                      isMe ? "Você não pode excluir a própria conta"
                        : !u.email ? "Cadastro sem e-mail — não é possível excluir por aqui"
                        : `Excluir ${label}`
                    }
                    aria-label={`Excluir ${label}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state.kind === "ready" && filtered.length > 0 && (totalPages > 1 || !!search) && (
        <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {totalPages > 1
              ? `${firstIndex + 1}–${firstIndex + pageUsers.length} de ${filtered.length}`
              : `${filtered.length} de ${users.length}`}
            {" "}usuário{filtered.length !== 1 ? "s" : ""}
            {search && totalPages > 1 ? ` (filtrados de ${users.length})` : ""}
          </p>
          <Pager page={current} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      {toEdit && (
        <EditUserModal
          key={toEdit.username || toEdit.email}
          user={toEdit}
          onSaved={name => handleSaved(toEdit, name)}
          onClose={() => setToEdit(null)}
        />
      )}

      {toDelete && (
        <DeleteUserModal
          user={toDelete}
          onDeleted={() => handleDeleted(toDelete)}
          onClose={() => setToDelete(null)}
        />
      )}

      {toReset && (
        <ResetPasswordModal
          user={toReset}
          isMe={!!myEmail && toReset.email.trim().toLowerCase() === myEmail}
          onDone={kind => handleReset(toReset, kind)}
          onClose={() => setToReset(null)}
        />
      )}

      {toDepartment && (
        <ChangeDepartmentModal
          key={`dep-${toDepartment.username || toDepartment.email}`}
          user={toDepartment}
          atual={toDepartment.idDepartment ? departmentById.get(toDepartment.idDepartment) : undefined}
          departments={departments}
          onSaved={name => handleDepartment(toDepartment, name)}
          onClose={() => setToDepartment(null)}
        />
      )}

      {toGroups && (
        <UserGroupsModal
          key={toGroups.username || toGroups.email}
          user={toGroups}
          onClose={() => setToGroups(null)}
        />
      )}
    </div>
  );
}
