// Env loader shared by e2e/scripts/start-webserver.mjs. Kept in its own file so
// it can be unit-tested with Vitest. Pure: no side effects on module import.

import fs from "node:fs";
import { parseEnv } from "node:util";

export function substitutePort(value, port) {
  return value.replaceAll("${E2E_PORT}", port);
}

/**
 * Merge keys from an env file into the given env object. Existing keys win,
 * matching `node --env-file=` semantics — so the caller decides precedence by
 * load order (load the higher-priority file first).
 *
 * `${E2E_PORT}` in values is substituted with the resolved port.
 *
 * @param {string} path                   File path, relative to cwd.
 * @param {object} opts
 * @param {boolean} opts.required         Throw if the file is missing.
 * @param {string}  opts.port             Port to substitute into ${E2E_PORT}.
 * @param {Record<string, string | undefined>} [opts.env]  Target env (defaults to process.env).
 */
export function loadEnvFile(path, { required, port, env = process.env }) {
  let content;
  try {
    content = fs.readFileSync(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") {
      if (required) throw new Error(`Required env file not found: ${path}`);
      return;
    }
    throw err;
  }

  const parsed = parseEnv(content);
  for (const [key, value] of Object.entries(parsed)) {
    if (key in env) continue;
    env[key] = substitutePort(value, port);
  }
}
