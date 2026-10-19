import { api } from "../lib/api";

export const LOGS_ENDPOINT = "/logs";

export type LogType = "CREATE" | "UPDATE" | "APPROVE" | "REJECT" | "DELETE" | "UNKNOWN";

export type LogEntry = {
  id: string;
  reservationType: string;
  modification: string;
  localModification: string;
  givenName: string;
  familyName: string;
  email: string;
  ip: string;
  groups: string[];
  typeLog: LogType;
  modificationDate: string;
  idData: number | null;
};

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  return "";
}

function plain(v: unknown): string {
  return str(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toType(v: unknown): LogType {
  const s = plain(v);
  if (s === "create" || s === "created" || s === "insert") return "CREATE";
  if (s === "update" || s === "updated" || s === "edit") return "UPDATE";
  if (s === "delete" || s === "deleted" || s === "remove") return "DELETE";
  if (s === "approve" || s === "approved" || s === "aprovada" || s === "aprovacao") return "APPROVE";
  if (s === "reject" || s === "rejected" || s === "reprovada" || s === "reprovacao") return "REJECT";
  return "UNKNOWN";
}

function decideType(raw: any): LogType {
  const tipo = toType(raw?.typeLog);
  if (tipo === "CREATE" || tipo === "DELETE" || tipo === "APPROVE" || tipo === "REJECT") return tipo;

  const texto = plain(raw?.modification);
  if (texto.includes("reprov") || texto.includes("rejeit") || texto.includes("recus") || texto.includes("negad")) return "REJECT";
  if (texto.includes("aprov")) return "APPROVE";
  return tipo;
}

function toGroups(v: unknown): string[] {
  const out: string[] = [];

  if (Array.isArray(v)) {
    for (const item of v) {
      const name = str(item);
      if (name) out.push(name);
    }
    return out;
  }

  let s = str(v);
  if (!s) return out;

  s = s.replace("[", "").replace("]", "");
  for (const part of s.split(",")) {
    const name = part.trim();
    if (name) out.push(name);
  }
  return out;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeLog(raw: any, index: number): LogEntry {
  return {
    id: String(raw?.id ?? index),
    reservationType: str(raw?.reservationType).toUpperCase(),
    modification: str(raw?.modification),
    localModification: str(raw?.localModification),
    givenName: str(raw?.givenName),
    familyName: str(raw?.familyName),
    email: str(raw?.email),
    ip: str(raw?.ip),
    groups: toGroups(raw?.groups),
    typeLog: decideType(raw),
    modificationDate: str(raw?.modificationDate),
    idData: toNumber(raw?.idData),
  };
}

function toArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const key of ["content", "logs", "items", "data", "results"]) {
    if (Array.isArray(data?.[key])) return data[key];
  }
  return [];
}

export function fullName(log: LogEntry): string {
  const name = `${log.givenName} ${log.familyName}`.trim();
  if (name) return name;
  if (log.email) return log.email;
  return "Usuário desconhecido";
}

export async function fetchLogs(page: number): Promise<LogEntry[]> {
  const { data } = await api.get(LOGS_ENDPOINT, { params: { offset: page } });
  return toArray(data).map(normalizeLog);
}
