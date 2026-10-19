import { clsx } from "clsx";
import { DEFAULT_ROLE, ROLE_LABELS, type Role } from "../../auth/roles";

const ROLE_PILL: Record<Role, string> = {
  geral:  "text-slate-700  dark:text-slate-200  bg-slate-100  dark:bg-slate-400/15  border-slate-300  dark:border-slate-400/40",
  frotas: "text-amber-800  dark:text-amber-200  bg-amber-100  dark:bg-amber-400/15  border-amber-300  dark:border-amber-400/40",
  da:     "text-blue-800   dark:text-blue-200   bg-blue-100   dark:bg-blue-400/15   border-blue-300   dark:border-blue-400/40",
  admin:  "text-purple-800 dark:text-purple-200 bg-purple-100 dark:bg-purple-400/15 border-purple-300 dark:border-purple-400/40",
};

const pillBase = "inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border flex-shrink-0";

export const fallbackLabel = ROLE_LABELS[DEFAULT_ROLE];

export function accessRole(role: Role | undefined): Role {
  return role ?? DEFAULT_ROLE;
}

export function RolePill({ role, groupName }: { role: Role | undefined; groupName: string }) {
  const effective = accessRole(role);

  if (!role) {
    return (
      <span
        className={clsx(pillBase, ROLE_PILL[effective], "border-dashed")}
        title={
          `"${groupName}" não casa com nenhuma regra de acesso conhecida, ` +
          `então concede o acesso padrão (${ROLE_LABELS[effective]}).`
        }
      >
        {ROLE_LABELS[effective]}
        <span className="font-normal opacity-70">· padrão</span>
      </span>
    );
  }

  return <span className={clsx(pillBase, ROLE_PILL[effective])}>{ROLE_LABELS[effective]}</span>;
}
