import { serviceItems } from "@/components/navbars/navbar-links";
import { safePostAuthDestination } from "@/lib/auth/redirect";
import { copilotName } from "@/lib/copilot/name";
import { encodeQueryComponent, safeDecode } from "@/lib/url";

/**
 * The sentence on the sign-in and sign-up pages that names what the user was
 * trying to open, built from the `redirect` the proxy or a menu link supplied.
 */

const maxNameLength = 60;
const genericPrompt = "To continue, you must sign in or create an account.";
const homeDirectory = "Home workspace directory";
const ownGroupFolders: ReadonlySet<string> = new Set([
  "Genome Groups",
  "Feature Groups",
]);

/** `serviceItems` is the only slug-to-title pairing; external entries (outbreak links) are skipped. */
const serviceTitles: ReadonlyMap<string, string> = new Map(
  Object.values(serviceItems)
    .flatMap(
      (section) => section.items as readonly { title: string; href: string }[],
    )
    .filter((item) => item.href.startsWith("/services/"))
    .map((item) => [item.href.slice("/services/".length), item.title] as const),
);

/**
 * A name from the `redirect` (attacker-controllable) is shown inside a trusted
 * sentence, so it loses control and format characters (NUL, newlines, bidi
 * overrides) and double-quote characters, so the name cannot close the quotes
 * it is shown in, and keeps one space between words.
 */
function cleanName(segment: string): string {
  return segment
    .replace(/[\p{Cc}\p{Cf}"“”]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Cut by code points, so an emoji is never split; `maxNameLength` includes the "…". */
function shortName(name: string): string {
  const chars = Array.from(name);
  return chars.length > maxNameLength
    ? `${chars.slice(0, maxNameLength - 1).join("")}…`
    : name;
}

/** A name taken from the URL is quoted so it reads as data, not as part of the sentence. */
function quotedName(name: string): string {
  return `“${shortName(name)}”`;
}

/** The cleaned last segment, or null when there is none or nothing is left of it. */
function lastName(segments: readonly string[]): string | null {
  const last = segments.at(-1);
  const name = last === undefined ? "" : cleanName(last);
  return name === "" ? null : name;
}

/** "the <last segment> folder", or null when the path has no usable last segment. */
function lastFolder(segments: readonly string[]): string | null {
  const name = lastName(segments);
  return name === null ? null : `the ${quotedName(name)} folder`;
}

/** `/workspace/home/…` carries no username, so it is the signed-in user's own home. */
function ownHomePhrase(path: readonly string[]): string | null {
  if (path.length === 0) return `your ${homeDirectory}`;
  const name = lastName(path);
  if (name === null) return null;
  if (path.length === 1 && ownGroupFolders.has(name)) return `your ${name}`;
  return `your ${quotedName(name)} folder`;
}

/** After the username: whose it is cannot be known signed out, so no "your". */
function userPathPhrase(path: readonly string[]): string | null {
  if (path.length === 0) return "this workspace";
  if (path.length === 1 && path[0] === "home") return `the ${homeDirectory}`;
  return lastFolder(path);
}

function workspacePhrase(rest: readonly string[]): string | null {
  const head = rest.at(0);
  const tail = rest.slice(1);
  switch (head) {
    case undefined:
      return `your ${homeDirectory}`;
    case "home":
      return ownHomePhrase(tail);
    case "shared":
      return tail.length === 0 ? "your workspaces" : lastFolder(tail);
    case "public":
      if (rest.length === 1) return "the Public Workspaces page";
      return rest.length === 2 ? "this public workspace" : lastFolder(rest);
    case "workshop":
      return "the BV-BRC Workshop page";
    default:
      return userPathPhrase(tail);
  }
}

function destinationPhrase(destination: string): string | null {
  const { pathname, search } = new URL(destination, "https://dxkb.internal");
  const segments = pathname.split("/").filter(Boolean).map(safeDecode);
  const [first, second] = segments;
  switch (first) {
    case "services": {
      const title = second ? serviceTitles.get(second) : undefined;
      return title ? `the ${title} service` : null;
    }
    case "jobs":
      return "your jobs";
    case "settings":
      return "your settings";
    case "copilot":
      return copilotName;
    case "viewer":
      return second === "structure" ? "the structure viewer" : null;
    case "genome":
      return new URLSearchParams(search).get("public") === "false"
        ? "your genomes"
        : null;
    case "workspace":
      return workspacePhrase(segments.slice(1));
    default:
      return null;
  }
}

/**
 * `null` when there is nothing to name (no redirect, the site root, or an
 * off-origin value), so the page keeps its usual copy; the generic sentence
 * when there is a redirect this module has no name for.
 */
export function signInPrompt(
  redirect: string | null | undefined,
): string | null {
  const destination = safePostAuthDestination(redirect ?? "");
  if (destination === "/") return null;
  const phrase = destinationPhrase(destination);
  return phrase
    ? `To access ${phrase}, you must sign in or create an account.`
    : genericPrompt;
}

/** The sign-in ⇄ sign-up link, keeping the return path when there is one. */
export function authLinkHref(
  path: "/sign-in" | "/sign-up",
  redirect: string | null | undefined,
): string {
  const destination = safePostAuthDestination(redirect ?? "");
  return destination === "/"
    ? path
    : `${path}?redirect=${encodeQueryComponent(destination)}`;
}
