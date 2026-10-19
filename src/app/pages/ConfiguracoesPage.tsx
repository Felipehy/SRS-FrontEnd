import { useState, type ReactNode } from "react";
import { Settings, Palette, Image, PanelLeft } from "lucide-react";
import { clsx } from "clsx";
import ColorsSection from "./settings/ColorsSection";
import ImageSection from "./settings/ImageSection";
import NavigationSection from "./settings/NavigationSection";

type Tab = {
  key: string;
  label: string;
  icon: React.ElementType;
  render: () => ReactNode;
};

const TABS: Tab[] = [
  { key: "cores",     label: "Cores",     icon: Palette,   render: () => <ColorsSection /> },
  { key: "foto",      label: "Foto",      icon: Image,     render: () => <ImageSection /> },
  { key: "navegacao", label: "Navegação", icon: PanelLeft, render: () => <NavigationSection /> },
];

export default function ConfiguracoesPage() {
  const [activeKey, setActiveKey] = useState(TABS[0].key);
  const active = TABS.find(t => t.key === activeKey) ?? TABS[0];

  return (
    <div className="h-full overflow-auto bg-background" style={{ scrollbarWidth: "none" }}>
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#5b4fcf]/10 flex items-center justify-center flex-shrink-0">
            <Settings size={22} className="text-[#5b4fcf]" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-0.5">Sua conta</p>
            <h1 style={{ fontFamily: "'Blinker', sans-serif" }} className="text-3xl text-foreground leading-tight">
              Configurações
            </h1>
          </div>
        </div>

        <nav className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto" style={{ scrollbarWidth: "none" }} aria-label="Abas das configurações">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.key === active.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveKey(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-2 -mb-px border-b-2 text-xs font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "border-[#5b4fcf] text-[#5b4fcf]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {active.render()}
      </div>
    </div>
  );
}
