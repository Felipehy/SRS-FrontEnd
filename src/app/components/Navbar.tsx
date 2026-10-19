import { NavLink } from "react-router";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, Calendar, Truck, Home, LayoutList, LayoutDashboard, ShieldCheck } from "lucide-react";
import { clsx } from "clsx";
import { useAuth, type Role } from "../context/AuthContext";
import AccountMenu from "./AccountMenu";
import logoSrs from "@/resources/img/favicon-branco-arredondado.svg";

type NavItem = {
  key: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  path: string;
  allowedRoles?: Role[];
};

export const NAV_ITEMS: NavItem[] = [
  { key: "home",          label: "Início",           shortLabel: "Início",    icon: Home,            path: "/",              allowedRoles: ["geral", "admin"] },
  { key: "da",            label: "Painel DA",        shortLabel: "Painel",    icon: LayoutDashboard, path: "/da",            allowedRoles: ["da", "admin"] },
  { key: "calendario",    label: "Calendário",       shortLabel: "Calendário", icon: Calendar,        path: "/calendario",    allowedRoles: ["geral", "admin"] },
  { key: "administracao", label: "Administração",    shortLabel: "Admin.",    icon: LayoutList,      path: "/administracao", allowedRoles: ["da", "admin"] },
  { key: "gestao-frotas", label: "Gestão de Frotas", shortLabel: "Frotas",    icon: Truck,           path: "/gestao-frotas", allowedRoles: ["frotas", "admin"] },
  { key: "admin",         label: "Painel Admin",     shortLabel: "Admin",     icon: ShieldCheck,     path: "/admin",         allowedRoles: ["admin"] },
];

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const isDark = theme === "dark";

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.allowedRoles) return true;
    if (!isAuthenticated || user?.activeRole === undefined) return false;
    return item.allowedRoles.includes(user.activeRole);
  });

  return (
    <header className="h-14 flex-shrink-0 border-b border-border bg-navbar backdrop-blur-sm sticky top-0 z-40">
      <div className="h-full m-auto max-w-screen px-4 flex items-center gap-2">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <img src={logoSrs} alt="" className="w-7 h-7 rounded-lg"/>
          </div>
          <span className="font-semibold text-sm text-color hidden sm:block tracking-wide">
            Reservas
          </span>
        </div>

        <nav className="flex items-center gap-0.5 flex-1 overflow-x-auto" style={{ scrollbarWidth: "none" }} aria-label="Navegação principal">
          {visibleItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex-shrink-0",
                    isActive
                      ? "bg-[#5b4fcf] text-white"
                      : "text-color-navbar hover:text-foreground hover:bg-muted"
                  )
                }
              >
                <Icon size={13} />
                <span className="hidden md:inline">{item.label}</span>
                <span className="md:hidden">{item.shortLabel}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            className="p-2 rounded-lg hover:bg-muted text-color-navbar transition-colors"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          {isAuthenticated && <AccountMenu />}
        </div>
      </div>
    </header>
  );
}
