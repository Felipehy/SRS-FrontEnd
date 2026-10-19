import { Lock } from "lucide-react";

const LGPD_URL = "https://prefeitura.sp.gov.br/web/obras/w/lgpd";

export default function PrivacyButton() {
  return (
    <a
      href={LGPD_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Privacidade"
      className="absolute bottom-3 left-3 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground shadow-md hover:text-foreground hover:border-[#5b4fcf] transition-colors"
    >
      <Lock size={13} className="flex-shrink-0" />
      <span>Privacidade</span>
    </a>
  );
}
