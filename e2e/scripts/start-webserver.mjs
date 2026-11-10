#!/usr/bin/env node
// Loads .env.e2e.local and .env.e2e.test (shell-exported vars win, then
// local, then test) and execs `next start -p <port>`; run `pnpm build` first.
// `node --env-file` is not usable: it propagates into NODE_OPTIONS, which
// Next's workers reject. Usage: node e2e/scripts/start-webserver.mjs [port]

import { spawn } from "node:child_process";
import { loadEnvFile } from "./env-loader.mjs";

// Resolve the port first so values can substitute ${E2E_PORT}.
const port = process.argv[2] ?? process.env.E2E_PORT ?? "3020";
process.env.E2E_PORT = port;

// Local loads first; the loader's existing-keys-win rule keeps its values.
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
