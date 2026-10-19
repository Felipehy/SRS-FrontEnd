import { useState, useEffect } from "react";
import { NavLink } from "react-router";
import { useTheme } from "../context/ThemeContext";
import { Sun, Moon, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { clsx } from "clsx";
import { useAuth } from "../context/AuthContext";
import { useBreakpoint } from "../utils/useBreakpoint";
import AccountMenu from "./AccountMenu";
import { NAV_ITEMS } from "./Navbar";
import logoSrs from "@/resources/img/favicon-branco-arredondado.svg";

function getInitialCollapsed(): boolean {
  if (window.innerWidth < 768) return true;
  try {
    const stored = localStorage.getItem("reservas:sidebar-collapsed");
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
  }
  return false;
}

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const breakpoint = useBreakpoint();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const isDark = theme === "dark";
  const isMobile = breakpoint === "mobile";
  const fullScreen = isMobile && !collapsed;

  useEffect(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (isMobile) return;
    try {
      localStorage.setItem("reservas:sidebar-collapsed", next ? "1" : "0");
    } catch {
    }
  };

  const closeOnMobile = () => {
    if (isMobile) setCollapsed(true);
  };

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.allowedRoles) return true;
    if (!isAuthenticated || user?.activeRole === undefined) return false;
    return item.allowedRoles.includes(user.activeRole);
  });

  return (
    <>
      {fullScreen && <div className="w-14 flex-shrink-0" />}

      <aside
        className={clsx(
          "flex-shrink-0 border-r border-border bg-navbar flex flex-col",
          fullScreen
            ? "fixed inset-0 w-full h-[100dvh] z-[60]"
            : clsx("h-full z-40 transition-[width] duration-200", collapsed ? "w-14" : "w-60")
        )}
      >
        <div
          className={clsx(
            "flex-shrink-0 border-b border-border flex items-center gap-2",
            collapsed ? "flex-col py-3 px-2" : "h-14 flex-row px-3.5"
          )}
        >
          <div className="w-7 h-7 rounded-lg bg-[#5b4fcf] flex items-center justify-center flex-shrink-0">
            <img src={logoSrs} alt="" className="w-7 h-7 rounded-lg"/>
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm text-color tracking-wide truncate">
              Reservas
            </span>
          )}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Abrir menu" : "Fechar menu"}
            title={collapsed ? "Abrir menu" : "Fechar menu"}
            className={clsx(
              "rounded-lg hover:bg-muted text-color-navbar transition-colors flex-shrink-0",
              fullScreen ? "p-2.5" : "p-2",
              !collapsed && "ml-auto"
            )}
          >
            {fullScreen ? <X size={18} /> : collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        <nav
          className={clsx(
            "flex-1 overflow-y-auto flex flex-col",
            fullScreen ? "px-3 py-4 gap-1" : "px-2 py-3 gap-0.5"
          )}
          style={{ scrollbarWidth: "none" }}
          aria-label="Navegação principal"
        >
          {visibleItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === "/"}
                title={item.label}
                onClick={closeOnMobile}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center rounded-lg font-medium transition-all",
                    fullScreen ? "gap-3 px-3 py-3 text-sm" : "gap-2 px-2.5 py-2 text-xs",
                    collapsed && "justify-center",
                    isActive
                      ? "bg-[#5b4fcf] text-white"
                      : "text-color-navbar hover:text-foreground hover:bg-muted"
                  )
                }
              >
                <Icon size={fullScreen ? 18 : 14} className="flex-shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div
          className={clsx(
            "flex-shrink-0 border-t border-border flex items-center gap-1",
            collapsed ? "flex-col p-2" : "flex-row p-2",
            fullScreen && "px-3 py-3 gap-2"
          )}
        >
          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
            className={clsx("rounded-lg hover:bg-muted text-color-navbar transition-colors", fullScreen ? "p-2.5" : "p-2")}
          >
            {isDark ? <Sun size={fullScreen ? 18 : 15} /> : <Moon size={fullScreen ? 18 : 15} />}
          </button>
          {isAuthenticated && <AccountMenu compact={collapsed} dropUp />}
        </div>
      </aside>
    </>
  );
}
