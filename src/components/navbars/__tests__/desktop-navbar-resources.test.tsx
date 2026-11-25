import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => "/genome",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

vi.mock("../theme-switcher-navbar", () => ({
  NavbarThemeSwitcher: () => null,
}));
vi.mock("../workspace-dropdown-content", () => ({
  WorkspaceDropdownContent: () => null,
}));
vi.mock("@/components/auth/su-banner", () => ({ SuBanner: () => null }));
vi.mock("@/components/auth/session-unverified-banner", () => ({
  SessionUnverifiedBanner: () => null,
}));
vi.mock("@/components/jobs/job-status-pill", () => ({
  JobStatusPill: () => null,
}));

// Every real Resources item opens in a new tab, so an in-app row is added to
// the real list to cover the ListItem branch that must stay unmarked.
vi.mock("../navbar-links", async (importOriginal) => {
  const original = await importOriginal<typeof import("../navbar-links")>();
  return {
    ...original,
    resourcesItems: [
      ...original.resourcesItems,
      {
        title: "Internal guide",
        href: "/guide",
        description: "A page inside the app.",
        target: "_self",
      },
    ],
  };
});

import DesktopNavbar from "../desktop-navbar";
import { resourcesItems } from "../navbar-links";

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const externalItems = resourcesItems.filter(
  (item) => item.target === "_blank",
);

describe("DesktopNavbar Resources menu", () => {
  async function openResources() {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DesktopNavbar />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Resources" }));
  }

  it("has exactly four external Resources items", () => {
    expect(externalItems.map((item) => item.title)).toEqual([
      "Documentation",
      "BV-BRC API",
      "BV-BRC",
      "GitHub",
    ]);
  });

  it.each(externalItems.map((item) => [item.title, item] as const))(
    "%s opens in a new tab with an external-link icon and a new-tab hint",
    async (title, item) => {
      await openResources();

      const link = await screen.findByRole("link", {
        name: new RegExp(`^${escapeRegExp(title)} \\(opens in a new tab\\)`),
      });

      expect(link).toHaveAttribute("href", item.href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      // The description stays in the name after the new-tab hint.
      expect(link).toHaveAccessibleName(
        `${title} (opens in a new tab) ${item.description}`,
      );
      expect(link.querySelector("svg.lucide-external-link")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    },
  );

  it("leaves an in-app Resources row without target, rel, icon or hint", async () => {
    await openResources();

    const link = await screen.findByRole("link", {
      name: /^Internal guide/,
    });

    expect(link).toHaveAttribute("href", "/guide");
    expect(link).not.toHaveAttribute("target");
    expect(link).not.toHaveAttribute("rel");
    expect(link.querySelector("svg")).toBeNull();
    expect(link).toHaveAccessibleName("Internal guide A page inside the app.");
  });
});
