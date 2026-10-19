import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search, X, RefreshCw, AlertTriangle, UsersRound, Plus, CheckCircle2, Trash2, Pencil,
  Save, UserPlus, UserMinus, Lock,
} from "lucide-react";
import { clsx } from "clsx";
import {
  addUserToGroup, createGroup, deleteGroup, groupColorOf, listGroupMembers, listGroups,
  memberNameKey, removeUserFromGroup, updateGroup,
  DEFAULT_GROUP_COLOR, GROUP_COGNITO_MAX, GROUP_COLOR_PRESETS, GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX,
  type AppGroup, type CreateGroup, type GroupMember,
} from "../../../api/service/groupService";
import { listUsers, type AppUser } from "../../../api/service/userService";
import { userImageUrl } from "../../../api/service/efsService";
import { GROUP_PREFIX, roleFromGroup } from "../../auth/albAuth";
import { ROLE_LABELS, type Role } from "../../context/AuthContext";
import UserAvatar from "../../components/UserAvatar";
import { RolePill, accessRole, fallbackLabel } from "./RolePill";

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

const GROUP_COGNITO_RE = /^[A-Za-z0-9._-]+$/;

type Errors = { groupName?: string; groupCognito?: string; description?: string };

function validateGroupName(value: string): string | undefined {
  const t = value.trim();
  if (!t) return "É necessário o nome do grupo";
  if (t.length > GROUP_NAME_MAX) return `Máximo de ${GROUP_NAME_MAX} caracteres`;
  return undefined;
}

function validateGroupCognito(value: string, taken: Set<string>): string | undefined {
  const t = value.trim();
  if (!t) return "É necessário o nome no Cognito";
  if (t.length > GROUP_COGNITO_MAX) return `Máximo de ${GROUP_COGNITO_MAX} caracteres`;
  if (!GROUP_COGNITO_RE.test(t)) return "Use letras, números, ponto, hífen ou sublinhado — sem espaços";
  if (taken.has(t.toLowerCase())) return "Já existe um grupo com esse nome no Cognito";
  return undefined;
}

function validateDescriptionLength(value: string): string | undefined {
  if (value.trim().length > GROUP_DESCRIPTION_MAX) {
    return `Máximo de ${GROUP_DESCRIPTION_MAX} caracteres`;
  }
  return undefined;
}

function validateDescription(value: string): string | undefined {
  if (!value.trim()) return "É necessária a descrição";
  return validateDescriptionLength(value);
}

function slugifyCognito(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base) return "";
  return `${GROUP_PREFIX}-${base}`;
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

function GroupAvatar({ color, size }: { color: string; size: number }) {
  return (
    <div
      className="rounded-xl flex items-center justify-center flex-shrink-0 border"
      style={{
        width: size,
        height: size,
        background: `${color}1f`,
        borderColor: `${color}40`,
      }}
    >
      <UsersRound size={Math.round(size * 0.42)} style={{ color }} />
    </div>
  );
}

function ColorPicker({ color, onChange, disabled }: {
  color: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div
        className="relative w-9 h-9 rounded-xl border border-black/5 dark:border-white/10 transition-shadow hover:shadow-md flex-shrink-0"
        style={{ background: color }}
        title="Escolher a cor do grupo"
      >
        <input
          type="color"
          value={color}
          disabled={disabled}
          onChange={e => onChange(e.target.value.toLowerCase())}
          aria-label="Cor do grupo"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
        />
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {GROUP_COLOR_PRESETS.map(preset => {
          const active = preset === color;
          return (
            <button
              key={preset}
              type="button"
              disabled={disabled}
              onClick={() => onChange(preset)}
              aria-label={`Usar a cor ${preset}`}
              title={preset}
              className={clsx(
                "w-6 h-6 rounded-lg border transition-transform hover:scale-110 disabled:cursor-default",
                active ? "border-foreground/50 scale-110" : "border-black/10 dark:border-white/15"
              )}
              style={{ background: preset }}
            />
          );
        })}
      </div>

      <span className="text-[11px] text-muted-foreground font-mono ml-auto">{color}</span>
    </div>
  );
}

function CreateGroupForm({ takenCognito, onCreated, onCancel }: {
  takenCognito: Set<string>;
  onCreated: (group: CreateGroup) => void;
  onCancel: () => void;
}) {
  const [groupName, setGroupName] = useState("");
  const [groupCognito, setGroupCognito] = useState("");
  const [cognitoTouched, setCognitoTouched] = useState(false);
  const [colorGroup, setColorGroup] = useState(DEFAULT_GROUP_COLOR);
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function changeGroupName(value: string) {
    setGroupName(value);
    setErrors(prev => ({ ...prev, groupName: undefined }));
    setSubmitError(null);
    if (!cognitoTouched) {
      setGroupCognito(slugifyCognito(value));
      setErrors(prev => ({ ...prev, groupCognito: undefined }));
    }
  }

  function changeGroupCognito(value: string) {
    setCognitoTouched(true);
    setGroupCognito(value);
    setErrors(prev => ({ ...prev, groupCognito: undefined }));
    setSubmitError(null);
  }

  function changeDescription(value: string) {
    setDescription(value);
    setErrors(prev => ({ ...prev, description: undefined }));
    setSubmitError(null);
  }

  const typedCognito = groupCognito.trim();
  const typedName = groupName.trim();
  const previewRole = typedCognito ? roleFromGroup(typedCognito) : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const found: Errors = {
      groupName: validateGroupName(groupName),
      groupCognito: validateGroupCognito(groupCognito, takenCognito),
      description: validateDescription(description),
    };
    setErrors(found);
    if (found.groupName || found.groupCognito || found.description) return;

    const payload: CreateGroup = {
      groupName: typedName,
      groupCognito: typedCognito,
      colorGroup,
      description: description.trim(),
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      await createGroup(payload);
      onCreated(payload);
    } catch (err: any) {
      const fieldErrors: Record<string, string> | undefined = err?.fieldErrors;
      const mapped: Errors = {};
      let restou = false;
      for (const [key, msg] of Object.entries(fieldErrors ?? {})) {
        if (key === "groupName" || key === "groupCognito" || key === "description") {
          mapped[key] = String(msg);
        } else {
          restou = true;
        }
      }
      const hasMapped = Object.keys(mapped).length > 0;
      if (hasMapped) setErrors(mapped);
      if (!hasMapped || restou) {
        setSubmitError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível criar o grupo. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4 p-5 mb-4 bg-card rounded-2xl border border-border/50">
      <div>
        <FieldLabel htmlFor="g-name">Nome do grupo *</FieldLabel>
        <div className="flex items-center gap-3">
          <GroupAvatar color={colorGroup} size={36} />
          <input
            id="g-name"
            autoFocus
            value={groupName}
            onChange={e => changeGroupName(e.target.value)}
            onBlur={() => setErrors(prev => ({ ...prev, groupName: validateGroupName(groupName) }))}
            maxLength={GROUP_NAME_MAX}
            autoComplete="off"
            aria-invalid={!!errors.groupName}
            placeholder="Ex.: Divisão de Frotas"
            className={inputCls(errors.groupName)}
          />
        </div>
        <FieldError msg={errors.groupName} />
        {!errors.groupName && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            É o nome que aparece no perfil de quem entra no grupo.
          </p>
        )}
      </div>

      <div>
        <FieldLabel htmlFor="g-cognito">Nome no Cognito *</FieldLabel>
        <input
          id="g-cognito"
          value={groupCognito}
          onChange={e => changeGroupCognito(e.target.value)}
          onBlur={() => setErrors(prev => ({ ...prev, groupCognito: validateGroupCognito(groupCognito, takenCognito) }))}
          maxLength={GROUP_COGNITO_MAX}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!errors.groupCognito}
          placeholder={`Ex.: ${GROUP_PREFIX}-frotas`}
          className={clsx(inputCls(errors.groupCognito), "font-mono")}
        />
        <FieldError msg={errors.groupCognito} />
        {!errors.groupCognito && (
          <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground">
            {typedCognito ? (
              <>
                <span>Acesso concedido:</span>
                <RolePill role={previewRole} groupName={typedCognito} />
              </>
            ) : (
              <span>É o nome que define o nível de acesso — não pode ser alterado depois.</span>
            )}
          </div>
        )}
      </div>

      <div>
        <FieldLabel>Cor do grupo</FieldLabel>
        <div className="px-3 py-2.5 rounded-xl bg-muted/50">
          <ColorPicker color={colorGroup} onChange={setColorGroup} disabled={submitting} />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="g-desc">Descrição *</FieldLabel>
        <textarea
          id="g-desc"
          rows={2}
          value={description}
          onChange={e => changeDescription(e.target.value)}
          onBlur={() => setErrors(prev => ({ ...prev, description: validateDescription(description) }))}
          maxLength={GROUP_DESCRIPTION_MAX}
          aria-invalid={!!errors.description}
          placeholder="Para que serve o grupo e quem deve entrar nele."
          className={clsx(inputCls(errors.description), "resize-y")}
        />
        <FieldError msg={errors.description} />
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
          <Plus size={13} /> {submitting ? "Criando…" : "Criar grupo"}
        </button>
      </div>
    </form>
  );
}

type Row = AppGroup & { role: Role | undefined };

function ModalShell({ titleId, locked, wide, onClose, children }: {
  titleId: string;
  locked: boolean;
  wide?: boolean;
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
        className={clsx(
          "bg-card rounded-2xl shadow-2xl w-full p-6 border border-border max-h-[85vh] overflow-y-auto",
          wide ? "max-w-lg" : "max-w-sm"
        )}
        style={{ animation: "modalIn 0.16s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        {children}
      </div>
      <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.93) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}

function EditGroupModal({ group, onSaved, onClose }: {
  group: Row;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [groupName, setGroupName] = useState(group.groupName);
  const [colorGroup, setColorGroup] = useState(groupColorOf(group));
  const [description, setDescription] = useState(group.description ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const newName = groupName.trim();
  const newDescription = description.trim();

  const changed =
    newName !== group.groupName ||
    colorGroup !== groupColorOf(group) ||
    newDescription !== (group.description ?? "");

  const preview: Row = { ...group, groupName: newName || group.groupName, colorGroup };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const found: Errors = {
      groupName: validateGroupName(groupName),
      description: newDescription ? validateDescriptionLength(newDescription) : undefined,
    };
    setErrors(found);
    if (found.groupName || found.description) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await updateGroup({
        groupName: newName,
        groupCognito: group.groupCognito,
        colorGroup,
        description: newDescription,
      });
      onSaved();
    } catch (err: any) {
      const fieldErrors: Record<string, string> | undefined = err?.fieldErrors;
      const mapped: Errors = {};
      let restou = false;
      for (const [key, msg] of Object.entries(fieldErrors ?? {})) {
        if (key === "groupName" || key === "description") {
          mapped[key] = String(msg);
        } else {
          restou = true;
        }
      }
      const hasMapped = Object.keys(mapped).length > 0;
      if (hasMapped) setErrors(mapped);
      if (!hasMapped || restou) {
        setSubmitError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível salvar o grupo. Tente novamente.");
      }
      setSubmitting(false);
    }
  }

  return (
    <ModalShell titleId="edit-group-title" locked={submitting} wide onClose={onClose}>
      <div className="flex items-start gap-3 mb-4">
        <GroupAvatar color={colorGroup} size={36} />
        <div className="min-w-0 flex-1">
          <h3 id="edit-group-title" className="text-base font-semibold text-foreground">Editar grupo</h3>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono break-all">{group.groupCognito}</p>
        </div>
        <RolePill role={group.role} groupName={group.groupCognito} />
      </div>

      <form onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-border bg-muted/40">
          <Lock size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            O nome no Cognito não pode ser alterado — é ele que define o nível de acesso.
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="eg-name">Nome do grupo *</FieldLabel>
          <input
            id="eg-name"
            autoFocus
            value={groupName}
            onChange={e => { setGroupName(e.target.value); setErrors(prev => ({ ...prev, groupName: undefined })); setSubmitError(null); }}
            onBlur={() => setErrors(prev => ({ ...prev, groupName: validateGroupName(groupName) }))}
            maxLength={GROUP_NAME_MAX}
            autoComplete="off"
            aria-invalid={!!errors.groupName}
            placeholder="Ex.: Divisão de Frotas"
            className={inputCls(errors.groupName)}
          />
          <FieldError msg={errors.groupName} />
          {!errors.groupName && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Aparece no perfil de quem está no grupo.
            </p>
          )}
        </div>

        <div>
          <FieldLabel>Cor do grupo</FieldLabel>
          <div className="px-3 py-2.5 rounded-xl bg-muted/50">
            <ColorPicker color={colorGroup} onChange={setColorGroup} disabled={submitting} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="eg-desc">Descrição (opcional)</FieldLabel>
          <textarea
            id="eg-desc"
            rows={2}
            value={description}
            onChange={e => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: undefined })); setSubmitError(null); }}
            maxLength={GROUP_DESCRIPTION_MAX}
            aria-invalid={!!errors.description}
            placeholder="Para que serve o grupo e quem deve entrar nele."
            className={clsx(inputCls(errors.description), "resize-y")}
          />
          <FieldError msg={errors.description} />
        </div>

        <div>
          <FieldLabel>Prévia no perfil</FieldLabel>
          <div className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
            <GroupChip group={preview} />
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
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-default"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || !changed}
            title={changed ? undefined : "Nada foi alterado"}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-default"
          >
            <Save size={13} /> {submitting ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function GroupChip({ group }: { group: { groupName: string; colorGroup?: string } }) {
  const color = groupColorOf(group);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border max-w-full"
      style={{ color, background: `${color}1f`, borderColor: `${color}55` }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="truncate">{group.groupName}</span>
    </span>
  );
}

type MembersState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; members: GroupMember[] };

type ResolvedMember = {
  key: string;
  member: GroupMember;
  user?: AppUser;
  username: string;
  ambiguous: boolean;
};

function userLabel(u: AppUser): string {
  const name = [u.givenName, u.familyName].filter(Boolean).join(" ");
  return name || u.email || u.username;
}

function initialsOf(u: AppUser): string {
  const initials = ((u.givenName[0] ?? "") + (u.familyName[0] ?? "")).toUpperCase();
  if (initials) return initials;
  return (u.email[0] ?? "?").toUpperCase();
}

function GroupMembersModal({ group, onChanged, onClose }: {
  group: Row;
  onChanged: (message: string) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<MembersState>({ kind: "loading" });
  const [allUsers, setAllUsers] = useState<AppUser[] | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const color = groupColorOf(group);

  const loadMembers = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      setState({ kind: "ready", members: await listGroupMembers(group) });
    } catch (err: any) {
      setState({ kind: "error", message: err?.detail ?? err?.title ?? err?.message ?? "Não foi possível carregar as pessoas do grupo." });
    }
  }, [group]);

  useEffect(() => {
    listUsers().then(setAllUsers).catch(() => setAllUsers([]));
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const byUsername = useMemo(
    () => new Map((allUsers ?? []).map(u => [u.username, u])),
    [allUsers]
  );

  const byEmail = useMemo(
    () => new Map((allUsers ?? []).filter(u => u.email).map(u => [u.email.toLowerCase(), u])),
    [allUsers]
  );

  const byNameKey = useMemo(() => {
    const map = new Map<string, AppUser[]>();
    for (const u of allUsers ?? []) {
      const key = memberNameKey(u.givenName, u.familyName);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(u);
      map.set(key, list);
    }
    return map;
  }, [allUsers]);

  const members: ResolvedMember[] = useMemo(() => {
    if (state.kind !== "ready") return [];
    return state.members.map((member, i) => {
      const nameKey = memberNameKey(member.givenName, member.familyName);
      const identified = !!(member.email || member.username);

      let user: AppUser | undefined;
      if (member.email) user = byEmail.get(member.email);
      if (!user && member.username) user = byUsername.get(member.username);

      let matches: AppUser[] = [];
      if (!user) {
        matches = nameKey ? byNameKey.get(nameKey) ?? [] : [];
        if (matches.length === 1) user = matches[0];
      }

      return {
        key: member.email || member.username || nameKey || `#${i}`,
        member,
        user,
        username: member.username || user?.username || "",
        ambiguous: !identified && matches.length > 1,
      };
    });
  }, [state, byNameKey, byUsername, byEmail]);

  const memberNameKeys = useMemo(
    () => new Set(
      members
        .filter(m => !m.member.email && !m.member.username)
        .map(m => memberNameKey(m.member.givenName, m.member.familyName))
        .filter(Boolean)
    ),
    [members]
  );
  const memberUsernames = useMemo(
    () => new Set(members.map(m => m.username).filter(Boolean)),
    [members]
  );
  const memberEmails = useMemo(
    () => new Set(members.map(m => m.member.email).filter(Boolean)),
    [members]
  );

  const candidates = useMemo(
    () => (allUsers ?? [])
      .filter(u => u.username
        && !memberUsernames.has(u.username)
        && !memberEmails.has(u.email.toLowerCase())
        && !memberNameKeys.has(memberNameKey(u.givenName, u.familyName)))
      .sort((a, b) => userLabel(a).localeCompare(userLabel(b), "pt-BR")),
    [allUsers, memberUsernames, memberEmails, memberNameKeys]
  );

  const picked = byUsername.get(pick);

  const loading = state.kind === "loading" || allUsers === null;

  async function run(username: string, op: () => Promise<string>, fallback: string) {
    setBusy(username);
    setActionError(null);
    try {
      const message = await op();
      onChanged(message || fallback);
      setPick("");
      await loadMembers();
    } catch (err: any) {
      setActionError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível concluir. Tente novamente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ModalShell titleId="group-members-title" locked={!!busy} wide onClose={onClose}>
      <div className="flex items-start gap-3 mb-4">
        <GroupAvatar color={color} size={36} />
        <div className="min-w-0 flex-1">
          <h3 id="group-members-title" className="text-base font-semibold text-foreground truncate">
            Pessoas de {group.groupName}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-all">
            <span className="font-mono">{group.groupCognito}</span>
            {state.kind === "ready" && ` · ${members.length} ${members.length === 1 ? "pessoa" : "pessoas"}`}
          </p>
        </div>
        <RolePill role={group.role} groupName={group.groupCognito} />
        <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>

      <div className="flex items-end gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <FieldLabel htmlFor="gm-add">Adicionar pessoa</FieldLabel>
          <select
            id="gm-add"
            value={pick}
            onChange={e => setPick(e.target.value)}
            disabled={!!busy || candidates.length === 0}
            className={clsx(inputCls(), "disabled:opacity-50")}
          >
            <option value="">
              {candidates.length === 0 ? "Nenhum usuário disponível" : "Selecione um usuário…"}
            </option>
            {candidates.map(u => (
              <option key={u.username} value={u.username}>
                {userLabel(u)}{u.email ? ` — ${u.email}` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => run(pick, () => addUserToGroup({ username: pick, group: group.groupCognito }),
            `${picked ? userLabel(picked) : "Usuário"} entrou em ${group.groupName}.`)}
          disabled={!pick || !!busy}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-default flex-shrink-0"
        >
          <UserPlus size={13} /> {busy === pick && pick ? "Adicionando…" : "Adicionar"}
        </button>
      </div>

      {actionError && (
        <div role="alert" className="flex items-start gap-2.5 mb-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 flex-shrink-0" />
          <p className="text-[11px] text-red-500">{actionError}</p>
        </div>
      )}

      {loading && state.kind !== "error" && (
        <div className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-14 bg-muted/50 rounded-xl animate-pulse" />)}
        </div>
      )}

      {state.kind === "error" && (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-red-500 leading-relaxed">
            <p>{state.message}</p>
            <button onClick={loadMembers} className="mt-2 px-2.5 py-1 rounded-lg bg-red-600 text-white font-medium hover:opacity-90 transition-opacity">
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && state.kind === "ready" && members.length === 0 && (
        <div className="text-center px-4 py-8 rounded-xl border border-border/50 bg-muted/30">
          <p className="text-xs text-muted-foreground">Nenhuma pessoa neste grupo ainda.</p>
        </div>
      )}

      {!loading && state.kind === "ready" && members.length > 0 && (
        <div className="space-y-2">
          {members.map(({ key, member, user, username, ambiguous }) => {
            const nameFromGroup = [member.givenName, member.familyName].filter(Boolean).join(" ");
            const email = user?.email || member.email;
            const label = user ? userLabel(user) : (nameFromGroup || member.username || email);
            const initials = user
              ? initialsOf(user)
              : ((member.givenName[0] ?? "") + (member.familyName[0] ?? "")).toUpperCase()
                || label.slice(0, 1).toUpperCase();
            const reason = ambiguous
              ? "Há mais de um usuário com este nome — remova pela aba Usuários, que identifica cada um pelo e-mail."
              : "Sem cadastro correspondente na lista de usuários — não é possível remover por aqui.";
            const detail = username ? (email === label ? "" : email) : reason;
            return (
              <div key={key} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-muted/30">
                <UserAvatar
                  name={label}
                  initials={initials}
                  pictureUrl={userImageUrl(email) || undefined}
                  className="w-8 h-8 flex-shrink-0"
                  style={{ background: `${color}1f` }}
                  textClassName="text-[10px]"
                  textStyle={{ color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{label}</p>
                  {detail && (
                    <p className={clsx("text-[11px] truncate", username ? "text-muted-foreground" : "text-amber-600")}>
                      {detail}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => run(key, () => removeUserFromGroup({ username, group: group.groupCognito }),
                    `${label} saiu de ${group.groupName}.`)}
                  disabled={!!busy || !username}
                  title={username ? `Tirar ${label} do grupo` : reason}
                  aria-label={`Tirar ${label} do grupo`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-30 disabled:hover:text-muted-foreground disabled:hover:bg-transparent disabled:cursor-default flex-shrink-0"
                >
                  <UserMinus size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

function DeleteGroupModal({ group, onDeleted, onClose }: {
  group: Row;
  onDeleted: () => void;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteGroup(group);
      onDeleted();
    } catch (err: any) {
      setError(err?.detail ?? err?.title ?? err?.message ?? "Não foi possível excluir o grupo. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <ModalShell titleId="del-group-title" locked={submitting} onClose={onClose}>
      <>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={16} className="text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 id="del-group-title" className="text-base font-semibold text-foreground">Excluir grupo</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              O grupo sai do Cognito e todos os usuários que estão nele perdem o vínculo.
              Não há como desfazer.
            </p>
          </div>
        </div>

        <div className="mt-4 px-3 py-2.5 rounded-xl bg-muted/50 border border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Grupo</p>
          <GroupChip group={group} />
          <p className="text-xs text-foreground font-mono mt-1.5 break-all">{group.groupCognito}</p>
          {group.description && (
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{group.description}</p>
          )}
        </div>

        <div className="flex items-start gap-2.5 mt-3 px-3 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
            Quem está neste grupo perde o perfil <strong className="font-semibold">{group.groupName}</strong>{" "}
            e o acesso de <strong className="font-semibold">{ROLE_LABELS[accessRole(group.role)]}</strong> que ele concede.
            Sem nenhum outro grupo, a pessoa passa a entrar como <strong className="font-semibold">{fallbackLabel}</strong>.
            {group.role === "admin" && " Se for o único grupo de administradores, ninguém mais entra nesta tela — nem você."}
          </p>
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
            <Trash2 size={13} /> {submitting ? "Excluindo…" : "Excluir grupo"}
          </button>
        </div>
      </>
    </ModalShell>
  );
}

type Notice =
  | { kind: "created"; groupName: string }
  | { kind: "updated"; groupName: string }
  | { kind: "deleted"; groupName: string }
  | { kind: "membership"; groupName: string; message: string };

function NoticeBanner({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const neutral = notice.kind === "deleted";

  let Icon = CheckCircle2;
  if (notice.kind === "deleted") Icon = Trash2;
  if (notice.kind === "membership") Icon = UsersRound;

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
            O grupo <span className="font-semibold">{notice.groupName}</span> foi criado
            e já aparece na lista.
          </>
        )}
        {notice.kind === "updated" && (
          <>
            O grupo <span className="font-semibold">{notice.groupName}</span> foi atualizado.
          </>
        )}
        {notice.kind === "deleted" && (
          <>
            O grupo <span className="font-semibold text-foreground">{notice.groupName}</span> foi
            excluído. Quem estava nele perdeu o vínculo.
          </>
        )}
        {notice.kind === "membership" && (
          <>
            {notice.message} <span className="opacity-70">(grupo <span className="font-medium">{notice.groupName}</span>)</span>
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

type ListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; groups: AppGroup[] };

export default function GroupsSection() {
  const [state, setState] = useState<ListState>({ kind: "loading" });
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const [toEdit, setToEdit] = useState<Row | null>(null);
  const [toInspect, setToInspect] = useState<Row | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const groups = await listGroups();
      setState({ kind: "ready", groups });
    } catch (err: any) {
      setState({ kind: "error", message: err?.detail ?? err?.title ?? err?.message ?? "Não foi possível carregar os grupos." });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = state.kind === "ready" ? state.groups : [];

  const rows = useMemo<Row[]>(
    () => groups
      .map(g => ({ ...g, role: roleFromGroup(g.groupCognito) }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName, "pt-BR")),
    [groups]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.groupName, r.groupCognito, r.description, r.role && ROLE_LABELS[r.role]]
        .some(v => v?.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const unmapped = rows.filter(r => !r.role).length;

  const takenCognito = useMemo(
    () => new Set(rows.map(r => r.groupCognito.toLowerCase())),
    [rows]
  );

  function handleCreated(group: CreateGroup) {
    setNotice({ kind: "created", groupName: group.groupName });
    setFormOpen(false);
    setSearch("");
    load();
  }

  function handleSaved(group: Row) {
    setNotice({ kind: "updated", groupName: group.groupName });
    setToEdit(null);
    load();
  }

  function handleDeleted(group: Row) {
    setNotice({ kind: "deleted", groupName: group.groupName });
    setToDelete(null);
    load();
  }

  function handleMembership(group: Row, message: string) {
    setNotice({ kind: "membership", groupName: group.groupName, message });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Grupos</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {state.kind === "ready"
              ? `${groups.length} grupo${groups.length !== 1 ? "s" : ""} no Cognito`
              : "Grupos do Cognito que definem os perfis de acesso."}
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
              <Plus size={12} /> Novo grupo
            </button>
          )}
        </div>
      </div>

      {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}

      {formOpen && (
        <CreateGroupForm
          takenCognito={takenCognito}
          onCreated={handleCreated}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {state.kind === "ready" && groups.length > 1 && (
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2 mb-3">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome do grupo, Cognito ou perfil…"
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
        <EmptyState icon={AlertTriangle} title="Não foi possível carregar os grupos">
          <p>{state.message}</p>
          <button onClick={load} className="mt-3 px-3 py-1.5 rounded-lg bg-[#5b4fcf] text-white text-xs font-medium hover:opacity-90 transition-opacity">
            Tentar novamente
          </button>
        </EmptyState>
      )}

      {state.kind === "ready" && groups.length === 0 && (
        <EmptyState icon={UsersRound} title="Nenhum grupo cadastrado">
          Sem grupos no user pool, todo usuário autenticado entra com o acesso padrão
          (<strong className="font-medium text-foreground">{fallbackLabel}</strong>) e sem perfil para escolher.
        </EmptyState>
      )}

      {state.kind === "ready" && groups.length > 0 && filtered.length === 0 && (
        <EmptyState icon={Search} title="Nenhum grupo encontrado">
          Nenhum grupo corresponde à busca.
        </EmptyState>
      )}

      {state.kind === "ready" && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map(g => {
            const color = groupColorOf(g);
            return (
              <div
                key={g.groupCognito}
                className="flex items-center gap-3.5 p-3.5 bg-card rounded-2xl border border-border/50 border-l-4"
                style={{ borderLeftColor: color }}
              >
                <GroupAvatar color={color} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-snug truncate">
                    {g.groupName}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{g.groupCognito}</p>
                  <p
                    className={clsx(
                      "text-[11px] mt-0.5 truncate",
                      g.description ? "text-muted-foreground" : "text-muted-foreground/60 italic"
                    )}
                    title={g.description}
                  >
                    {g.description ?? "Sem descrição"}
                  </p>
                </div>
                <RolePill role={g.role} groupName={g.groupCognito} />

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => { setNotice(null); setToInspect(g); }}
                    title={`Ver pessoas de ${g.groupName}`}
                    aria-label={`Ver pessoas de ${g.groupName}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-[#5b4fcf] hover:bg-[#5b4fcf]/10 transition-colors"
                  >
                    <UsersRound size={14} />
                  </button>
                  <button
                    onClick={() => { setNotice(null); setToEdit(g); }}
                    title={`Editar ${g.groupName}`}
                    aria-label={`Editar ${g.groupName}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-[#5b4fcf] hover:bg-[#5b4fcf]/10 transition-colors"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { setNotice(null); setToDelete(g); }}
                    title={`Excluir ${g.groupName}`}
                    aria-label={`Excluir ${g.groupName}`}
                    className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {state.kind === "ready" && filtered.length > 0 && !!search && (
        <p className="text-xs text-muted-foreground mt-3">
          {filtered.length} de {groups.length} grupo{groups.length !== 1 ? "s" : ""}
        </p>
      )}

      {state.kind === "ready" && unmapped > 0 && (
        <div role="status" className="flex items-start gap-2.5 mt-3 px-4 py-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            {unmapped === 1 ? "1 grupo não casa" : `${unmapped} grupos não casam`} com nenhuma
            regra de acesso conhecida — {unmapped === 1 ? "ele aparece" : "eles aparecem"} normalmente
            como perfil, mas {unmapped === 1 ? "concede" : "concedem"} o acesso padrão de{" "}
            <strong className="font-semibold">{fallbackLabel}</strong>. Para dar outro nível de acesso,
            o nome no Cognito precisa conter <span className="font-mono">geral</span>,{" "}
            <span className="font-mono">frotas</span>, <span className="font-mono">da</span> ou{" "}
            <span className="font-mono">administrador</span>.
          </p>
        </div>
      )}

      {toInspect && (
        <GroupMembersModal
          group={toInspect}
          onChanged={msg => handleMembership(toInspect, msg)}
          onClose={() => setToInspect(null)}
        />
      )}

      {toEdit && (
        <EditGroupModal
          group={toEdit}
          onSaved={() => handleSaved(toEdit)}
          onClose={() => setToEdit(null)}
        />
      )}

      {toDelete && (
        <DeleteGroupModal
          group={toDelete}
          onDeleted={() => handleDeleted(toDelete)}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
