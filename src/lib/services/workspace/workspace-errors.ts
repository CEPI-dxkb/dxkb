/**
 * Which workspace failures mean "the object is not there", as opposed to
 * "the workspace service could not answer".
 *
 * The BV-BRC Workspace reports a missing object as a JSON-RPC error inside an
 * HTTP 500: `Workspace.get` of a missing path answers "_ERROR_Object … not
 * found_ERROR_", and `Workspace.ls` of a home that was never created answers
 * "_ERROR_User lacks permission to …_ERROR_". The proxy forwards that text as
 * `apiResponse.message` (and `WorkspaceApiClient` keeps "BV-BRC API error:
 * 500 …" as the message), so both places are read.
 *
 * An outage is never "missing": during one, every call fails, and treating
 * that as "not found" told users their folders had been deleted and drove
 * folder creation and favorites overwrites from a failed read. Outage answers
 * are the proxy's 502/503/504 (`isUpstreamOutage`) or, server-side, an
 * `UpstreamError`.
 *
 * Only the Workspace's own wording counts (`_error` in BV-BRC's
 * `WorkspaceImpl.pm`): "Object not found!", "Workspace not found!",
 * "Workspace u/home does not exist!" and "User lacks permission to u/home for
 * requested action!", at the start of a message or right after its `_ERROR_`
 * marker. A bare "not found" is not enough: JSON-RPC's "Method not found" and
 * an outage's "…: host not found" contain it too, and reading either as
 * "missing" would report a taken name as free or overwrite favorites.
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

/** The error's own message and the upstream message the proxy forwarded. */
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
 * readable by this user: an HTTP 404, or one of the Workspace's "not found /
 * does not exist / lacks permission" replies. False for outages and every
 * other failure.
 */
export function isWorkspaceObjectMissing(error: unknown): boolean {
  if (!error || isOutage(error)) return false;
  if (property(error, "status") === 404) return true;
  return workspaceErrorMessages(error).some((message) =>
    missingObjectPattern.test(message),
  );
}

/**
 * True when listing a user's home failed because the home was never created
 * ("User lacks permission" / "Workspace … does not exist"), the one failure
 * that makes provisioning it the right response.
 */
export function isWorkspaceHomeMissing(error: unknown): boolean {
  if (!error || isOutage(error)) return false;
  return workspaceErrorMessages(error).some((message) =>
    missingHomePattern.test(message),
  );
}

/** The proxy's own label for a Workspace error reply; the reason is in `apiResponse`. */
const genericProxyMessage = /^BV-BRC API error: \d{3}\b/;

/** "_ERROR_Object not found!_" and "_ERROR_User lacks permission_ERROR_" → the text inside. */
function stripErrorMarkers(message: string): string {
  return message.replace(/^_ERROR_|_ERROR_$|(?<=!)_$/g, "").trim();
}

/**
 * The condensed, user-facing text of a workspace failure. Prefers the
 * Workspace's own reason ("Object /u@bvbrc/home/x not found!") over the
 * proxy's "BV-BRC API error: 500 Internal Server Error" label, without the
 * `_ERROR_` markers BV-BRC wraps it in.
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
