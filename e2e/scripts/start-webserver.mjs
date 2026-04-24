#!/usr/bin/env node
// Wrapper that loads .env.e2e.local (optional, dev overrides) and .env.e2e.test
// (committed defaults) into process.env, then execs `next start -p <port>`.
//
// Caller is responsible for having a valid .next/ build; we do not run `next build`
// here because a cold build blows past Playwright's default webServer timeout and
// prevents targeted runs like `playwright test foo.spec.ts` from starting.
//
// We can't use node's --env-file flag directly because it propagates into
// NODE_OPTIONS, and Next's build worker threads reject NODE_OPTIONS containing
// --env-file (ERR_WORKER_INVALID_EXEC_ARGV).
//
// Precedence (highest first): shell-exported vars > .env.e2e.local > .env.e2e.test.
// Values can reference ${E2E_PORT}; env-loader substitutes at load time so the
// committed defaults stay port-agnostic.
//
// Usage: node e2e/scripts/start-webserver.mjs [port]

import { spawn } from "node:child_process";
import { loadEnvFile } from "./env-loader.mjs";

// Resolve the port first so .env.e2e.* values can substitute ${E2E_PORT}.
const port = process.argv[2] ?? process.env.E2E_PORT ?? "3020";
process.env.E2E_PORT = port;

// Load order matters: local first (higher precedence), committed defaults second.
// The loader's "existing keys win" rule means local values are preserved when .test loads.
loadEnvFile(".env.e2e.local", { required: false, port });
loadEnvFile(".env.e2e.test", { required: true, port });

const nextBin = "node_modules/next/dist/bin/next";

function runStep(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [nextBin, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code, signal) => {
      if (signal) return reject(new Error(`next ${args[0]} killed by ${signal}`));
      if (code === 0) return resolve();
      reject(new Error(`next ${args[0]} exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

try {
  await runStep(["start", "-p", port]);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
