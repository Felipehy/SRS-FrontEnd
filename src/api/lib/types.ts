export interface BaseProblem {
    type?: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
}

export interface ValidationProblem extends BaseProblem {
    errors: Record<string, string>;
}

export type ProblemDetail = BaseProblem | ValidationProblem;

export interface SpringErrorBody {
    timestamp?: string;
    status?: number;
    error?: string;
    message?: string;
    path?: string;
    errors?: unknown;
}

export interface ApiErrors {
    status: number | null;
    title: string;
    detail: string;
    fieldErrors?: Record<string, string>;
    raw?: unknown;
}
