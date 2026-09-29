vi.mock("server-only", () => ({}));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { testCookieStore } from "@/test-helpers/api-route-helpers";
import { defaultUiPreferences } from "../definitions";
import * as provider from "../provider";
import { readUiPreferences } from "../server";

const moduleDir = join(__dirname, "..");

/** A whole-line directive; the "use client" mentioned in a comment does not count. */
function hasUseClientDirective(fileName: string): boolean {
  return /^\s*(?:"use client"|'use client');?\s*$/m.test(
    readFileSync(join(moduleDir, fileName), "utf8"),
  );
}

describe("readUiPreferences", () => {
  it("returns defaults when no preference cookies are present", async () => {
    await expect(readUiPreferences()).resolves.toStrictEqual(
      defaultUiPreferences,
    );
  });

  it("reads stored preferences from the request cookies", async () => {
    testCookieStore.set("dxkb-view-nav-collapsed", "true");
    testCookieStore.set(
      "dxkb-workspace-panel-layout",
      '{"workspace-main":30,"workspace-details":70}',
    );
    await expect(readUiPreferences()).resolves.toStrictEqual({
      ...defaultUiPreferences,
      viewNavCollapsed: true,
      workspacePanelLayout: { "workspace-main": 30, "workspace-details": 70 },
    });
  });
});

// The root layout (a Server Component) imports definitions.ts and cookie.ts. A value
// exported from a "use client" module reaches server code as a client reference, so
// the cookie read came back undefined on every request. That regression otherwise
// shows up only as a three-minute webServer timeout in e2e.
describe("preference modules server code imports", () => {
  it("keeps the client directive out of definitions.ts and cookie.ts", () => {
    expect(hasUseClientDirective("definitions.ts")).toBe(false);
    expect(hasUseClientDirective("cookie.ts")).toBe(false);
  });

  it("detects the directive where it is present", () => {
    expect(hasUseClientDirective("provider.tsx")).toBe(true);
  });

  it("exports only a component and a hook from the client provider", () => {
    expect(Object.keys(provider).sort()).toStrictEqual([
      "UiPreferencesProvider",
      "useUiPreference",
    ]);
  });
});
