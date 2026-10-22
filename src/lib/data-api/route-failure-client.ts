/**
 * Error reading for the browser side of same-origin Data API routes. A route's
 * `{error, code}` body carries the specific failure; it is used verbatim so a
 * specific diagnosis is never replaced by a generic one, falling back to the
 * status line only when there is no JSON body (an aborted response, a proxy
 * error page).
 */
async function failureDetail(response: Response): Promise<string> {
  const payload: unknown = await response.json().catch(() => null);
  const error =
    payload && typeof payload === "object"
      ? (payload as { error?: unknown }).error
      : undefined;
  return typeof error === "string" && error.trim() !== ""
    ? error
    : `${String(response.status)} ${response.statusText}`;
}

/**
 * A non-OK answer as an error carrying its HTTP `status`, so the app-wide
 * retry policy skips an immediate retry of an upstream outage (502–504).
 */
export async function httpFailure(
  response: Response,
  subject: string,
): Promise<Error> {
  return Object.assign(
    new Error(`${subject}: ${await failureDetail(response)}`),
    { status: response.status },
  );
}
