#!/usr/bin/env node
// Wrapper that loads .env.e2e.test (+ optional .env.e2e.local) into process.env
// and then execs `next build && next start -p <port>`. We can't use node's
// --env-file=... flag directly because it propagates into NODE_OPTIONS, and
// Next's build worker threads reject NODE_OPTIONS that contains --env-file.
//
// Usage: node e2e/scripts/start-webserver.mjs [port]

import fs from "node:fs";
import { spawn } from "node:child_process";
import { parseEnv } from "node:util";

function loadEnvFile(path, { required }) {
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
    // Match `node --env-file=` semantics: do not override values already set
    // by the parent shell. Lets CI or a dev export an override and win.
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.e2e.test", { required: true });
loadEnvFile(".env.e2e.local", { required: false });

const port = process.argv[2] ?? process.env.E2E_PORT ?? "3020";
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
  await runStep(["build"]);
  await runStep(["start", "-p", port]);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
