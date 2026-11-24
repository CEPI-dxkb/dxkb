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

const outbreakTitles = [
  "Measles 2025",
  "Influenza H5N1 2024",
  "Mpox 2024",
  "SARS-CoV-2",
];

describe("DesktopNavbar Services menu external links", () => {
  async function openServices() {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <DesktopNavbar />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Services" }));
  }

  it.each(outbreakTitles)(
    "%s opens in a new tab and shows an external-link icon",
    async (title) => {
      await openServices();

      const link = await screen.findByRole("link", {
        name: `${title} (opens in a new tab)`,
      });

      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.querySelector("svg.lucide-external-link")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    },
  );

  it("leaves in-app service links without an icon or new-tab target", async () => {
    await openServices();

    const blast = await screen.findByRole("link", { name: "BLAST" });

    expect(blast).not.toHaveAttribute("target", "_blank");
    expect(blast.querySelector("svg")).toBeNull();
  });
});
