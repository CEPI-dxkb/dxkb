import { chromium, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import readline from "node:readline";

import { HAR_REPLAY_HOST_PLACEHOLDER } from "./har-constants";

/** Placeholder values written into HARs in place of real credentials / PII. */
const E2E_USERNAME_PLACEHOLDER = "e2e-test-user";
const E2E_PASSWORD_PLACEHOLDER = "REDACTED-PASSWORD";
const E2E_EMAIL_PLACEHOLDER = "e2e@example.com";

/**
 * Strip credentials and PII from a HAR file in place. Replaces:
 *  - the live username with `E2E_USERNAME_PLACEHOLDER`
 *  - the live password with `E2E_PASSWORD_PLACEHOLDER`
 *  - any email-shaped substring in request/response bodies with `E2E_EMAIL_PLACEHOLDER`
 *
 * Walks request post bodies and response content (both JSON strings or JSON-RPC
 * envelopes) and drops any header in `SENSITIVE_HEADER_NAMES` from both request
 * and response — `mode: "minimal"` already omits most headers, but the auth
 * cookie / set-cookie pair is not minimal-stripped and must be removed explicitly.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Headers that may carry session tokens, signed cookies, or other credentials.
 * Drop them entirely from the recorded HAR — `routeFromHAR` doesn't need them
 * for matching, and the served set-cookie would otherwise reach the browser at
 * replay time. Compared lower-case.
 */
const SENSITIVE_HEADER_NAMES = new Set([
  "cookie",
  "authorization",
  "proxy-authorization",
  "set-cookie",
  "authentication-info",
  "x-auth-token",
  "x-api-key",
]);

interface HarHeader {
  name: string;
  value: string;
}

interface HarEntry {
  request: {
    url: string;
    headers?: HarHeader[];
    postData?: { text?: string };
  };
  response: {
    headers?: HarHeader[];
    content?: { text?: string };
    redirectURL?: string;
    cookies?: unknown[];
  };
}

export function sanitizeHar(
  harPath: string,
  user: string,
  password: string,
  recordedOrigin: string,
): void {
  const raw = fs.readFileSync(harPath, "utf8");
  const har = JSON.parse(raw) as { log: { entries: HarEntry[] } };

  const userRe = user ? new RegExp(escapeRegExp(user), "g") : null;
  const passwordRe = password ? new RegExp(escapeRegExp(password), "g") : null;
  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const originRe = new RegExp(escapeRegExp(recordedOrigin), "g");

  const scrub = (text: string): string => {
    let next = text;
    if (passwordRe) next = next.replace(passwordRe, E2E_PASSWORD_PLACEHOLDER);
    if (userRe) next = next.replace(userRe, E2E_USERNAME_PLACEHOLDER);
    next = next.replace(emailRe, E2E_EMAIL_PLACEHOLDER);
    return next.replace(originRe, HAR_REPLAY_HOST_PLACEHOLDER);
  };

  const stripSensitiveHeaders = (headers: HarHeader[] | undefined): HarHeader[] | undefined =>
    headers?.filter((h) => !SENSITIVE_HEADER_NAMES.has(h.name.toLowerCase()));

  for (const entry of har.log.entries) {
    // Drop sensitive headers + structured cookies; the per-string scrub below
    // handles non-sensitive headers (Referer, etc.) and parsed queryString/cookies.
    entry.request.headers = stripSensitiveHeaders(entry.request.headers);
    entry.response.headers = stripSensitiveHeaders(entry.response.headers);
    if (entry.response.cookies) entry.response.cookies = [];
  }

  // Scrub during serialization via a replacer so each string is matched in its
  // unescaped form. Scrubbing the post-stringify text would miss credentials
  // containing JSON-escaped chars (e.g. a password with `"` or `\` becomes
  // `\"` / `\\` in the output and the raw-credential regex no longer matches).
  // Reaches every place the username can leak — request.url, response.redirectURL,
  // queryString/cookies values, non-sensitive header values, entry.pageref,
  // response.content.text, request.postData.text, and anything Playwright adds
  // in a future schema bump — without enumerating fields by hand.
  fs.writeFileSync(
    harPath,
    JSON.stringify(har, (_key, value) => (typeof value === "string" ? scrub(value) : value), 2),
  );
  assertNoSensitiveData(harPath, user, password);
}

/**
 * Belt-and-suspenders check that fails the recorder if any pattern that looks like
 * a credential, BV-BRC token, or the live username/password slipped past
 * `sanitizeHar`. The check runs against the on-disk file (post-write), so it
 * catches drift in either the sanitizer or the HAR shape.
 */
export function assertNoSensitiveData(harPath: string, user: string, password: string): void {
  const text = fs.readFileSync(harPath, "utf8");
  const violations: string[] = [];

  // A credential containing `"`, `\`, or a control character is JSON-escaped
  // in the on-disk file (e.g. `pa$$"word` → `pa$$\"word`), so a raw
  // `text.includes(secret)` would miss the leak. Check the JSON-escaped form too.
  const includesAnyForm = (secret: string): boolean => {
    if (text.includes(secret)) return true;
    const escaped = JSON.stringify(secret).slice(1, -1);
    return escaped !== secret && text.includes(escaped);
  };

  if (user && includesAnyForm(user)) {
    violations.push(`live username "${user}" appears in HAR`);
  }
  if (password && includesAnyForm(password)) {
    violations.push(`live password appears in HAR`);
  }
  // BV-BRC tokens are pipe-delimited fields ending in a hex `sig=` — match the
  // signature segment, which is the only piece that's hard to imitate by accident.
  if (/sig=[0-9a-f]{32,}/i.test(text)) {
    violations.push("BV-BRC-shaped session token (sig=<hex>) appears in HAR");
  }
  if (/Authorization":\s*"Bearer\s+\S/i.test(text)) {
    violations.push("Authorization: Bearer token appears in HAR");
  }

  if (violations.length > 0) {
    fs.unlinkSync(harPath);
    throw new Error(
      `Refusing to commit HAR with sensitive data:\n  - ${violations.join(
        "\n  - ",
      )}\nDeleted ${harPath}. Update the sanitizer in e2e/scripts/record-har.ts and re-record.`,
    );
  }
}

export interface JourneyEnv {
  baseURL: string;
  user: string;
  password: string;
}

export type JourneyDriver = (page: Page, env: JourneyEnv) => Promise<void>;

function loadEnvE2e(): void {
  const envPath = path.resolve(process.cwd(), ".env.e2e");
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.e2e. Copy .env.e2e.example and fill in credentials.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

async function loadJourneyDriver(name: string): Promise<JourneyDriver | null> {
  const journeyPath = path.resolve(process.cwd(), "e2e/scripts/journeys", `${name}.ts`);
  if (!fs.existsSync(journeyPath)) return null;
  const mod = (await import(pathToFileURL(journeyPath).href)) as {
    default?: JourneyDriver;
    drive?: JourneyDriver;
  };
  const driver = mod.default ?? mod.drive;
  if (typeof driver !== "function") {
    throw new Error(
      `Journey "${name}" at ${journeyPath} must export a default function or named "drive" function.`,
    );
  }
  return driver;
}

async function promptEnter(question: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}

async function main(): Promise<void> {
  const [, , journeyName] = process.argv;
  if (!journeyName) {
    console.error("Usage: pnpm e2e:record <journey-name>");
    console.error("Example: pnpm e2e:record auth-sign-in");
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(journeyName)) {
    console.error(
      `Invalid journey name "${journeyName}". Use only letters, numbers, dashes, and underscores.`,
    );
    process.exit(1);
  }

  loadEnvE2e();
  // Default to `pnpm start` (production build, port 3010) rather than `pnpm dev`.
  // Dev mode + Turbopack injects HMR plumbing that blocks React hydration in
  // headless Chromium, which means the auth boundary's useEffect never fires
  // and journeys that depend on a hydrated client (sign-in, signed-in pages)
  // hang. Production build hydrates cleanly.
  const baseURL = process.env.E2E_RECORD_BASE_URL ?? "http://127.0.0.1:3010";
  const user = process.env.E2E_TEST_USER ?? "";
  const password = process.env.E2E_TEST_PASSWORD ?? "";
  const outDir = path.resolve(process.cwd(), "e2e/fixtures/hars");
  fs.mkdirSync(outDir, { recursive: true });
  const harPath = path.join(outDir, `${journeyName}.har`);

  const driver = await loadJourneyDriver(journeyName);
  const headless = driver ? process.env.E2E_RECORD_HEADED !== "1" : false;

  console.log(`Recording journey "${journeyName}" against ${baseURL}`);
  console.log(`Output: ${harPath}`);
  console.log(driver ? "Mode: scripted (driver found)" : "Mode: interactive");

  // Only record requests that a spec's page.route() could meaningfully replay:
  // the app's own /api/** namespace and outbound BV-BRC / PATRIC / TheSEED / NCBI
  // hosts. Skips _next/static, fonts, and images so the HAR stays small enough to
  // diff in code review. Keep this regex in sync with applyBackendMocks's
  // backendHostPattern in e2e/mocks/backends.ts.
  const harUrlFilter =
    /^https?:\/\/(?:[^/]+\/api\/|(?:[a-z0-9-]+\.)*(?:patricbrc\.org|bv-brc\.org|theseed\.org|ncbi\.nlm\.nih\.gov))/i;

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    recordHar: {
      path: harPath,
      mode: "minimal",
      content: "embed",
      urlFilter: harUrlFilter,
    },
    baseURL,
  });
  const page = await context.newPage();

  let driverError: unknown;
  try {
    if (driver) {
      await driver(page, { baseURL, user, password });
    } else {
      await page.goto(baseURL);
      console.log("The browser will stay open. Drive the journey manually, then press Enter.");
      await promptEnter("Press Enter here when you are done with the journey...");
    }
  } catch (e) {
    driverError = e;
  } finally {
    // Closing the context flushes the HAR to disk. Must happen before sanitize
    // so the file actually exists.
    await context.close();
    await browser.close();
  }

  // Always sanitize what hit disk, even if the driver threw partway through.
  // Otherwise a partial HAR full of live credentials would sit in the workspace
  // until someone noticed (or worse, got committed). `sanitizeHar` deletes the
  // file when its post-write assertion finds anything sensitive.
  if (fs.existsSync(harPath)) {
    const recordedOrigin = new URL(baseURL).origin;
    sanitizeHar(harPath, user, password, recordedOrigin);
  }

  if (driverError) {
    // Re-throw after sanitizing so the recorder still exits non-zero.
    throw driverError;
  }
  console.log(`HAR saved to ${harPath}`);
}

// Only run main() when invoked as a script. Vitest imports this module to
// exercise sanitizeHar / assertNoSensitiveData directly; without the guard the
// recorder would launch a browser whenever the test file is loaded.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
