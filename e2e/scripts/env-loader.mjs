// Env loader for start-webserver.mjs, in its own file so Vitest can test it;
// no side effects on import.

import fs from "node:fs";
import { parseEnv } from "node:util";

export function substitutePort(value, port) {
  return value.replaceAll("${E2E_PORT}", port);
}

/**
 * Merges an env file into `env`; existing keys win (like `node --env-file=`),
 * so load the higher-priority file first. `${E2E_PORT}` in values is
 * substituted with `opts.port`.
 *
 * @param {string} path
 * @param {object} opts
 * @param {boolean} opts.required
 * @param {string} opts.port
 * @param {Record<string, string | undefined>} [opts.env]
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
