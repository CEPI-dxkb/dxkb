import { chromium, type Page } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import readline from "node:readline";

import { loadEnvFile } from "./env-loader.mjs";
import { harReplayHostPlaceholder } from "./har-constants";

const usernamePlaceholder = "e2e-test-user";
const passwordPlaceholder = "REDACTED-PASSWORD";
const emailPlaceholder = "e2e@example.com";

const sensitiveHeaderNames = new Set([
  "cookie",
  "authorization",
  "proxy-authorization",
  "set-cookie",
  "authentication-info",
  "x-auth-token",
  "x-api-key",
]);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

/**
 * Username scrubbing runs before email scrubbing because a realm-qualified
 * user id (`liveuser@patricbrc.org`) also matches the email regex.
 */
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
    if (passwordRe) next = next.replace(passwordRe, passwordPlaceholder);
    if (userRe) next = next.replace(userRe, usernamePlaceholder);
    next = next.replace(emailRe, emailPlaceholder);
    return next.replace(originRe, harReplayHostPlaceholder);
  };

  const stripSensitiveHeaders = (
    headers: HarHeader[] | undefined,
  ): HarHeader[] | undefined =>
    headers?.filter((h) => !sensitiveHeaderNames.has(h.name.toLowerCase()));

  for (const entry of har.log.entries) {
    entry.request.headers = stripSensitiveHeaders(entry.request.headers);
    entry.response.headers = stripSensitiveHeaders(entry.response.headers);
    if (entry.response.cookies) entry.response.cookies = [];
  }

  // Scrub in a JSON replacer so strings are matched unescaped; scrubbing the
  // stringified text would miss credentials containing `"` or `\`.
  fs.writeFileSync(
    harPath,
    JSON.stringify(
      har,
      (_key, value: unknown) =>
        typeof value === "string" ? scrub(value) : value,
      2,
    ),
  );
  assertNoSensitiveData(harPath, user, password);
}

export function assertNoSensitiveData(
  harPath: string,
  user: string,
  password: string,
): void {
  const text = fs.readFileSync(harPath, "utf8");
  const violations: string[] = [];

  // A credential with `"`, `\` or a control character is JSON-escaped on
  // disk, so also check the escaped form.
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
  // Match the hex `sig=` segment of BV-BRC tokens, the part that is hard to
  // imitate by accident.
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

async function loadJourneyDriver(name: string): Promise<JourneyDriver | null> {
  const journeyPath = path.resolve(
    process.cwd(),
    "e2e/scripts/journeys",
    `${name}.ts`,
  );
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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
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
    console.error("Example: pnpm e2e:record workspace-browse");
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(journeyName)) {
    console.error(
      `Invalid journey name "${journeyName}". Use only letters, numbers, dashes, and underscores.`,
    );
    process.exit(1);
  }

  loadEnvFile(path.resolve(process.cwd(), ".env.e2e"), {
    required: true,
    port: process.env.E2E_PORT ?? "3020",
  });
  // Default to `pnpm start`: dev mode HMR blocks hydration in headless
  // Chromium, so the auth boundary never runs.
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

  // Keep in sync with `backendHostPattern` in e2e/mocks/backends.ts.
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
      console.log(
        "The browser will stay open. Drive the journey manually, then press Enter.",
      );
      await promptEnter(
        "Press Enter here when you are done with the journey...",
      );
    }
  } catch (e) {
    driverError = e;
  } finally {
    await context.close();
    await browser.close();
  }

  // Sanitize even if the driver threw, so a partial HAR with live credentials
  // is never left on disk.
  if (fs.existsSync(harPath)) {
    const recordedOrigin = new URL(baseURL).origin;
    sanitizeHar(harPath, user, password, recordedOrigin);
  }

  if (driverError) {
    throw driverError instanceof Error
      ? driverError
      : new Error(
          `HAR driver failed: ${typeof driverError === "string" ? driverError : JSON.stringify(driverError)}`,
        );
  }
  console.log(`HAR saved to ${harPath}`);
}

// Vitest imports this module; the guard stops it from launching a browser.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
