export type ApiErrorCode =
  | "session_expired" // app session guard 401
  | "unauthenticated" // upstream/auth service 401
  | "forbidden"
  | "not_found"
  | "validation"
  | "upstream"
  | "unknown";

export interface ApiError {
  message: string;
  status: number;
  code: ApiErrorCode;
  details?: unknown;
}

export class ApiCallError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiCallError";
    this.status = error.status;
    this.code = error.code;
    this.details = error.details;
  }
}

export function statusToErrorCode(status: number): ApiErrorCode {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status >= 400 && status < 500) return "validation";
  if (status >= 500) return "upstream";
  return "unknown";
}
