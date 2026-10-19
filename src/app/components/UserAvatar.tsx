import type { CSSProperties } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { cn } from "./ui/utils";

export type AvatarStatus = "idle" | "loading" | "loaded" | "error";

export default function UserAvatar({
  name,
  initials,
  pictureUrl,
  className,
  style,
  textClassName,
  textStyle,
  onStatusChange,
}: {
  name?: string;
  initials: string;
  pictureUrl?: string;
  className?: string;
  style?: CSSProperties;
  textClassName?: string;
  textStyle?: CSSProperties;
  onStatusChange?: (status: AvatarStatus) => void;
}) {
  return (
    <Avatar className={cn("w-9 h-9 bg-[#5b4fcf]", className)} style={style}>
      {pictureUrl && (
        <AvatarImage
          key={pictureUrl}
          src={pictureUrl}
          alt={name ? `Foto de ${name}` : "Foto de perfil"}
          className="object-cover"
          onLoadingStatusChange={onStatusChange}
        />
      )}
      <AvatarFallback className="bg-transparent">
        <span className={cn("text-[11px] text-white font-semibold leading-none", textClassName)} style={textStyle}>
          {initials}
        </span>
      </AvatarFallback>
    </Avatar>
  );
}
