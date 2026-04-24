import { test as setup } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const authFile = path.resolve(process.cwd(), "e2e/.auth/public.json");

setup("public (no-auth) storage state", async ({ context }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await context.storageState({ path: authFile });
});
