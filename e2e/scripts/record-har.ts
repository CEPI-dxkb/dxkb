import { chromium } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import readline from "node:readline";

function loadEnvE2e(): void {
  const envPath = path.resolve(process.cwd(), ".env.e2e");
  if (!fs.existsSync(envPath)) {
    console.error("Missing .env.e2e. Copy .env.e2e.example and fill in credentials.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (match) process.env[match[1]] = match[2].replace(/^"|"$/g, "");
  }
}

async function prompt(question: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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
    console.error("Example: pnpm e2e:record auth-sign-in");
    process.exit(1);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(journeyName)) {
    console.error(
      `Invalid journey name "${journeyName}". Use only letters, numbers, dashes, and underscores.`,
    );
    process.exit(1);
  }

  loadEnvE2e();
  const baseURL = process.env.E2E_RECORD_BASE_URL ?? "http://127.0.0.1:3019";
  const outDir = path.resolve(process.cwd(), "e2e/fixtures/hars");
  fs.mkdirSync(outDir, { recursive: true });
  const harPath = path.join(outDir, `${journeyName}.har`);

  console.log(`Recording journey "${journeyName}" against ${baseURL}`);
  console.log(`Output: ${harPath}`);
  console.log("The browser will open. Drive the journey manually, then close the window.");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordHar: { path: harPath, mode: "minimal", content: "embed" },
    baseURL,
  });
  const page = await context.newPage();
  await page.goto(baseURL);

  await prompt("Press Enter here when you are done with the journey...");

  await context.close();
  await browser.close();
  console.log(`HAR saved to ${harPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
