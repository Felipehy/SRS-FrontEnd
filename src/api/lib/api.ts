import axios, { AxiosError } from "axios";
import type { ApiErrors } from "./types";

export interface ApiError {
    status: number | null,
    title: string,
    detail: string,
    raw?: unknown;
}

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

function statusFallback(status: number): { title: string; detail: string } {
    switch (status) {
        case 400: return { title: "Requisição inválida", detail: "Os dados enviados são inválidos." };
        case 401: return { title: "Não autenticado", detail: "Sua sessão expirou ou você não está autenticado." };
        case 403: return { title: "Sem permissão", detail: "Você não tem permissão para realizar esta ação." };
        case 404: return { title: "Não encontrado", detail: "O recurso solicitado não foi encontrado." };
        case 405: return { title: "Método não permitido", detail: "Esta operação não é permitida neste recurso." };
        case 409: return { title: "Conflito", detail: "Já existe um registro em conflito com esta operação." };
        case 415: return { title: "Formato não suportado", detail: "O formato enviado não é suportado." };
        case 422: return { title: "Dados inválidos", detail: "Verifique os campos e tente novamente." };
        case 429: return { title: "Muitas requisições", detail: "Aguarde um momento e tente novamente." };
        case 500: return { title: "Erro interno do servidor", detail: "Ocorreu um erro no servidor. Tente novamente." };
        case 502:
        case 503:
        case 504: return { title: "Servidor indisponível", detail: "O servidor está temporariamente indisponível." };
        default:  return { title: `Erro ${status}`, detail: "Ocorreu um erro inesperado." };
    }
}

function extractFieldErrors(data: any): Record<string, string> | undefined {
    const errs = data?.errors;
    if (!errs) return undefined;

    if (Array.isArray(errs)) {
        const out: Record<string, string> = {};
        for (const e of errs) {
            const field = e?.field ?? e?.property;
            const msg = e?.defaultMessage ?? e?.message;
            if (field && msg) {
                out[String(field)] = String(msg);
            }
        }
        if (Object.keys(out).length > 0) return out;
        return undefined;
    }

    if (typeof errs === "object") return errs as Record<string, string>;
    return undefined;
}

function nonEmpty(v: unknown): string | undefined {
    if (typeof v === "string" && v.trim()) return v.trim();
    return undefined;
}

api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        let apiError: ApiErrors;

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data as any;
            const fb = statusFallback(status);

            let title = fb.title;
            let detail = fb.detail;

            if (typeof data === "string") {
                const s = data.trim();
                if (s && !s.startsWith("<") && s.length <= 300) {
                    detail = s;
                }
            } else if (data && typeof data === "object") {
                title = nonEmpty(data.title) ?? nonEmpty(data.error) ?? fb.title;
                detail = nonEmpty(data.detail) ?? nonEmpty(data.message) ?? fb.detail;
            }

            apiError = {
                status,
                title,
                detail,
                fieldErrors: extractFieldErrors(data),
                raw: data,
            };
        } else if (error.request) {
            apiError = {
                status: null,
                title: "Sem resposta do servidor",
                detail: "Verifique sua conexão ou se o servidor está no ar.",
            };
        } else {
            apiError = {
                status: null,
                title: "Erro interno",
                detail: error.message || "Ocorreu um erro ao preparar a requisição.",
            };
        }

        return Promise.reject(apiError);
    }
);
