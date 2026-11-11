/**
 * Which workspace failures mean "the object is not there", as opposed to "the
 * service could not answer". The Workspace reports a missing object as a
 * JSON-RPC error inside an HTTP 500, so only its own wording counts (a bare
 * "not found" also matches "Method not found" and "host not found"); an outage
 * must never read as "missing", or users are told folders were deleted and
 * favorites get overwritten.
 */

import { isUpstreamOutage } from "@/lib/api/query-retry";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { formatUserFacingErrorMessage } from "@/lib/utils";

const missingObjectPattern =
  /(?:^|_ERROR_)\s*(?:Object\b.*\bnot found|Workspace not found|Workspace\b.*\bdoes not exist|User lacks permission)/i;
const missingHomePattern =
  /(?:^|_ERROR_)\s*(?:Workspace\b.*\bdoes not exist|User lacks permission)/i;

function property(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null && key in value
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function workspaceErrorMessages(error: unknown): string[] {
  const apiResponse = property(error, "apiResponse");
  return [
    property(error, "message"),
    apiResponse,
    property(apiResponse, "message"),
  ].filter((value): value is string => typeof value === "string");
}

function isOutage(error: unknown): boolean {
  return error instanceof UpstreamError || isUpstreamOutage(error);
}

/**
 * True when the Workspace answered that the object does not exist or is not
 * readable: an HTTP 404 or one of its "not found / does not exist / lacks
 * permission" replies; false for outages.
 */
export function isWorkspaceObjectMissing(error: unknown): boolean {
  if (!error || isOutage(error)) return false;
  if (property(error, "status") === 404) return true;
  return workspaceErrorMessages(error).some((message) =>
    missingObjectPattern.test(message),
  );
}

/**
 * True when listing a user's home failed because it was never created, the one
 * failure that makes provisioning the right response.
 */
export function isWorkspaceHomeMissing(error: unknown): boolean {
  if (!error || isOutage(error)) return false;
  return workspaceErrorMessages(error).some((message) =>
    missingHomePattern.test(message),
  );
}

const genericProxyMessage = /^BV-BRC API error: \d{3}\b/;

function stripErrorMarkers(message: string): string {
  return message.replace(/^_ERROR_|_ERROR_$|(?<=!)_$/g, "").trim();
}

/**
 * The condensed, user-facing text of a workspace failure: the Workspace's own
 * reason without `_ERROR_` markers, preferred over the proxy's "BV-BRC API
 * error: 500" label.
 */
export function workspaceErrorMessage(error: unknown, fallback: string): string {
  const message = property(error, "message");
  const apiResponse = property(error, "apiResponse");
  const upstream = [property(apiResponse, "message"), apiResponse].find(
    (value): value is string => typeof value === "string" && !!value.trim(),
  );
  const text =
    typeof message === "string" &&
    message.trim() &&
    !(upstream && genericProxyMessage.test(message))
      ? message
      : upstream;
  return formatUserFacingErrorMessage(
    text ? new Error(stripErrorMarkers(text)) : error,
    fallback,
  );
}
