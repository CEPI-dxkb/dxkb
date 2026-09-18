import { test as setup } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { bvbrcCookies } from "../fixtures/overrides/auth-session";
import { resolveSignedInStatePath } from "./storage-state";

setup(
  "seed mocked session cookies",
  async ({ context, baseURL }, testInfo) => {
    // Both Playwright configs testMatch this file, so the destination depends on
    // which config is running it — see e2e/auth/storage-state.ts.
    const authFile = path.resolve(
      process.cwd(),
      resolveSignedInStatePath(testInfo.project.name),
    );
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    if (!baseURL)
      throw new Error("baseURL must be configured in playwright.config.ts");
    const parsedHost = new URL(baseURL).hostname;

    await context.addCookies(
      bvbrcCookies.map((cookie) => ({
        ...cookie,
        domain: parsedHost,
      })),
    );

    await context.storageState({ path: authFile });
  },
);
