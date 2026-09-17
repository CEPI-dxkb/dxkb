import { test as setup } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { resolvePublicStatePath } from "./storage-state";

setup("public (no-auth) storage state", async ({ context }, testInfo) => {
  // Both Playwright configs testMatch this file, so the destination depends on
  // which config is running it — see e2e/auth/storage-state.ts.
  const authFile = path.resolve(
    process.cwd(),
    resolvePublicStatePath(testInfo.project.name),
  );
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
});
