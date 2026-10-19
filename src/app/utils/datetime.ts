export const TIME_ZONE = "America/Sao_Paulo";

export function parseInstant(iso: string | null | undefined): Date | null {
  if (!iso) return null;

  let s = iso.trim().replace(" ", "T");
  s = s.replace(/(\.\d{3})\d+/, "$1");
  if (s.includes("T") && !/(Z|[+-]\d{2}:?\d{2})$/.test(s)) s += "Z";

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatInstant(iso: string | null | undefined, options: Intl.DateTimeFormatOptions): string | null {
  const d = parseInstant(iso);
  if (!d) return null;
  return d.toLocaleString("pt-BR", { timeZone: TIME_ZONE, ...options });
}
