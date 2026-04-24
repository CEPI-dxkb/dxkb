import { test as setup } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { bvbrcCookies } from "../mocks/backends";

const authFile = path.resolve(process.cwd(), "e2e/.auth/user.json");

setup("seed mocked session cookies", async ({ context, baseURL }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  if (!baseURL) throw new Error("baseURL must be configured in playwright.config.ts");
  const parsedHost = new URL(baseURL).hostname;

  await context.addCookies(
    bvbrcCookies.map((cookie) => ({
      ...cookie,
      domain: parsedHost,
    })),
  );

  await context.storageState({ path: authFile });
});
