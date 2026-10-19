import { useState } from "react";
import { useNavigate } from "react-router";
import { Settings, LogOut, UserCheck, ChevronDown, GraduationCap } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useAuth, ROLE_LABELS, type UserGroup } from "../context/AuthContext";
import { useTutorial } from "../context/TutorialContext";
import { useBreakpoint } from "../utils/useBreakpoint";
import UserAvatar from "./UserAvatar";
import { clsx } from "clsx";

function groupTitle(group: UserGroup): string {
  if (group.mapped) return `Acesso de ${ROLE_LABELS[group.role]}`;
  return `Este grupo não corresponde a nenhum perfil do app — acesso de ${ROLE_LABELS[group.role]}`;
}

export default function AccountMenu({ compact = false, dropUp = false }: { compact?: boolean; dropUp?: boolean }) {
  const { user, switchGroup, logout } = useAuth();
  const navigate = useNavigate();
  const tutorial = useTutorial();
  const breakpoint = useBreakpoint();
  const [showGroups, setShowGroups] = useState(false);
  if (!user) return null;

  const active = user.activeGroup;
  const canSwitch = user.groups.length > 1;
  const isMobile = breakpoint === "mobile";

  function toggleGroups(e: Event) {
    e.preventDefault();
    setShowGroups(!showGroups);
  }

  function onOpenChange(open: boolean) {
    if (!open) setShowGroups(false);
  }

  const groupItems = user.groups.map(group => {
    const isActive = group.groupCognito === active.groupCognito;
    return (
      <DropdownMenuItem
        key={group.groupCognito}
        className="gap-2 cursor-pointer items-start"
        title={groupTitle(group)}
        onSelect={() => switchGroup(group.groupCognito)}
      >
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: isActive ? group.color : "transparent", border: `1px solid ${group.color}` }}
        />
        <span className="min-w-0 flex-1">
          <span className={clsx("block truncate", isActive && "font-semibold")}>
            {group.groupName}
          </span>
          <span className="block text-[10px] text-muted-foreground truncate">
            Acesso de {ROLE_LABELS[group.role]}
          </span>
        </span>
        {isActive && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0 mt-0.5">ativo</span>
        )}
      </DropdownMenuItem>
    );
  });

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={clsx(
            "group flex items-center gap-2 text-color-navbar transition-colors focus:outline-none",
            compact ? "p-1 justify-center rounded-full" : "px-2 py-1 rounded-xl"
          )}
          aria-label="Menu de conta"
        >
          <UserAvatar
            name={user.name}
            initials={user.initials}
            pictureUrl={user.pictureUrl}
            className="w-7 h-7"
          />
          {!compact && (
            <>
              <span className="hidden md:block text-xs font-medium max-w-28 truncate">{user.name}</span>
              <ChevronDown
                size={12}
                className={clsx(
                  "text-color hidden md:block transition-transform duration-200",
                  dropUp
                    ? "rotate-180 group-data-[state=open]:rotate-0"
                    : "group-data-[state=open]:rotate-180"
                )}
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent side={dropUp ? "top" : "bottom"} align="end" collisionPadding={8} className="w-56 z-[70]">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full w-fit mt-0.5 border max-w-full"
              style={{ color: active.color, background: `${active.color}1f`, borderColor: `${active.color}55` }}
              title={groupTitle(active)}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active.color }} />
              <span className="truncate">{active.groupName}</span>
            </span>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => navigate("/configuracoes")}>
          <Settings size={14} className="text-muted-foreground" />
          <span>Configurações</span>
        </DropdownMenuItem>

        {tutorial.available && (
          <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => tutorial.start()}>
            <GraduationCap size={14} className="text-muted-foreground" />
            <span>Refazer tutorial</span>
          </DropdownMenuItem>
        )}

        {canSwitch && isMobile && (
          <>
            <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={toggleGroups}>
              <UserCheck size={14} className="text-muted-foreground" />
              <span>Trocar de perfil</span>
              <ChevronDown
                size={14}
                className={clsx("ml-auto text-muted-foreground transition-transform duration-200", showGroups && "rotate-180")}
              />
            </DropdownMenuItem>
            {showGroups && <div className="pl-3">{groupItems}</div>}
          </>
        )}

        {canSwitch && !isMobile && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2 cursor-pointer">
              <UserCheck size={14} className="text-muted-foreground" />
              <span>Trocar de perfil</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent collisionPadding={8} className="max-w-64 z-[70]">
              {groupItems}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30"
          onSelect={logout}
        >
          <LogOut size={14} />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}