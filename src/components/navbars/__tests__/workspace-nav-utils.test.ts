import { safePostAuthDestination } from "@/lib/auth/redirect";

import { workspaceNavItems } from "../navbar-links";
import { resolveWorkspaceHref } from "../workspace-nav-utils";

const allItems = Object.values(workspaceNavItems).flatMap(
  (section) => section.items,
);

function itemTitled(title: string) {
  const item = allItems.find((candidate) => candidate.title === title);
  if (!item) {
    throw new Error(`no workspace nav item titled "${title}"`);
  }
  return item;
}

describe("resolveWorkspaceHref", () => {
  it("gives every menu item its own destination when signed out", () => {
    const hrefs = allItems.map((item) => resolveWorkspaceHref(item, "", false));

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("gives every menu item its own destination when signed in", () => {
    const hrefs = allItems.map((item) =>
      resolveWorkspaceHref(item, "alice@bvbrc", true),
    );

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it.each([
    ["Home", "/workspace"],
    ["My Workspaces", "/workspace/shared"],
    ["My Genome Groups", "/workspace/home/Genome%20Groups"],
    ["My Feature Groups", "/workspace/home/Feature%20Groups"],
  ])(
    "%s returns to its own page after sign-in",
    (title, expectedDestination) => {
      const href = resolveWorkspaceHref(itemTitled(title), "", false);
      const redirect = new URL(href, "https://dxkb.internal").searchParams.get(
        "redirect",
      );

      expect(href.startsWith("/sign-in?redirect=")).toBe(true);
      expect(safePostAuthDestination(redirect ?? "")).toBe(expectedDestination);
    },
  );
});
