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

import DesktopNavbar from "../desktop-navbar";

const legacyPageTitles = [
  "Protein Structure Prediction",
  "StabiliNNator",
  "FrustraMPNN",
  "Structure Sequence Prediction",
  "Stability Prediction",
  "Mobile Element Detection",
];

describe("DesktopNavbar Services menu legacy-page items", () => {
  async function openServices() {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DesktopNavbar />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Services" }));
  }

  it("lists Structure Prediction as a section heading", async () => {
    await openServices();

    expect(
      await screen.findByRole("heading", { name: "Structure Prediction" }),
    ).toBeInTheDocument();
  });

  it.each(legacyPageTitles)(
    "%s opens in a new tab with an external-link icon to the right of its label",
    async (title) => {
      await openServices();

      const link = await screen.findByRole("link", {
        name: `${title} (opens in a new tab)`,
      });

      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");

      const icon = link.querySelector("svg.lucide-external-link");
      expect(icon).toHaveAttribute("aria-hidden", "true");

      const children = Array.from(link.childNodes);
      const labelIndex = children.findIndex(
        (node) => node.textContent === title,
      );
      expect(labelIndex).toBeGreaterThanOrEqual(0);
      const iconIndex = children.findIndex((node) => node === icon);
      expect(iconIndex).toBeGreaterThan(labelIndex);
    },
  );
});
