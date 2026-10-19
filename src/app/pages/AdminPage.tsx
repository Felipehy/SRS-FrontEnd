import { useState, type ReactNode } from "react";
import { ShieldCheck, Users, UsersRound, ScrollText, Building2, Landmark, Mail } from "lucide-react";
import { clsx } from "clsx";
import DepartmentsSection from "./admin/DepartmentsSection";
import GroupsSection from "./admin/GroupsSection";
import LogsSection from "./admin/LogsSection";
import RoomsSection from "./admin/RoomsSection";
import SmtpSection from "./admin/SmtpSection";
import UsersSection from "./admin/UsersSection";

type Section = {
  key: string;
  label: string;
  icon: React.ElementType;
  pending?: string;
  render: () => ReactNode;
};

const SECTIONS: Section[] = [
  {
    key: "logs",
    label: "Logs",
    icon: ScrollText,
    pending: "Aguardando a API",
    render: () => <LogsSection />,
  },
  {
    key: "usuarios",
    label: "Usuários",
    icon: Users,
    render: () => <UsersSection />,
  },
  {
    key: "grupos",
    label: "Grupos",
    icon: UsersRound,
    render: () => <GroupsSection />,
  },
  {
    key: "salas",
    label: "Salas",
    icon: Building2,
    render: () => <RoomsSection />,
  },
  {
    key: "departamentos",
    label: "Departamentos",
    icon: Landmark,
    pending: "Aguardando a API",
    render: () => <DepartmentsSection />,
  },
  {
    key: "smtp",
    label: "SMTP",
    icon: Mail,
    render: () => <SmtpSection />,
  },
];

export default function AdminPage() {
  const [activeKey, setActiveKey] = useState(SECTIONS[0].key);
  const active = SECTIONS.find(s => s.key === activeKey) ?? SECTIONS[0];

  return (
    <div className="h-full overflow-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#5b4fcf]/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={22} className="text-[#5b4fcf]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-0.5">Painel Admin</p>
            <h1 style={{ fontFamily: "'Google Sans', sans-serif" }} className="text-3xl text-foreground leading-tight">
              Administração do sistema
            </h1>
          </div>
        </div>

        <nav className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto" style={{ scrollbarWidth: "none" }} aria-label="Seções do painel">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const isActive = section.key === active.key;
            return (
              <button
                key={section.key}
                onClick={() => setActiveKey(section.key)}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-[#5b4fcf] text-[#5b4fcf]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={13} />
                {section.label}
                {section.pending && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title={section.pending} />
                )}
              </button>
            );
          })}
        </nav>

        {active.render()}
      </div>
    </div>
  );
}
