import { api } from "../lib/api";

export const EFS_ENDPOINT = "/anexos";

function apiBase(): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return base.replace(/\/$/, "");
}

export function profileImageUrl(version?: string | number): string {
  if (version) {
    return `${apiBase()}/anexos/img?v=${encodeURIComponent(version)}`;
  }
  return `${apiBase()}/anexos/img`;
}

export function userImageUrl(email: string): string {
  const target = email.trim();
  if (!target) return "";
  return `${apiBase()}/anexos/imgs?email=${encodeURIComponent(target)}`;
}

export async function uploadEfsFile(
  file: File,
  onProgress?: (percent: number | null) => void,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);

  await api.post(EFS_ENDPOINT, form, {
    headers: { "Content-Type": undefined },
    onUploadProgress: (e) => {
      if (!onProgress) return;
      if (e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      } else {
        onProgress(null);
      }
    },
  });
}

export async function deleteEfsFile(): Promise<void> {
  await api.delete(EFS_ENDPOINT + "/delete");
}
