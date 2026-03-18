/**
 * Structured error for API route handlers.
 * Throw an ApiError inside a protectedRoute handler to return a specific HTTP status.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(typeof body === "string" ? body : JSON.stringify(body));
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}
