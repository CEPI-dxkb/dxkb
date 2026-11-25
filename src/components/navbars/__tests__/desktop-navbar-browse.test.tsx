import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthBoundary } from "@/lib/auth/provider";
import DesktopNavbar from "../desktop-navbar";
import {
  browseOrganismItems,
  dataTypeItems,
  featuredVirusItems,
} from "../navbar-links";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: vi.fn() }),
}));
vi.mock("../user-avatar-dropdown", () => ({
  UserAvatarDropdown: () => <button type="button">Account menu</button>,
}));
vi.mock("../theme-switcher-navbar", () => ({
  NavbarThemeSwitcher: () => null,
}));
vi.mock("../workspace-dropdown-content", () => ({
  WorkspaceDropdownContent: () => null,
}));
vi.mock("@/components/jobs/job-status-pill", () => ({
  JobStatusPill: () => null,
}));

describe("DesktopNavbar Browse menu", () => {
  it("groups the CEPI taxa, the organism links and the data types in one panel", async () => {
    const user = userEvent.setup();
    render(
      <AuthBoundary user={null}>
        <DesktopNavbar />
      </AuthBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "Browse" }));

    const first = await screen.findByRole("link", { name: "Bunyaviricetes" });
    const menu = first.closest<HTMLElement>(
      '[data-slot="navigation-menu-content"]',
    );
    expect(menu).not.toBeNull();
    const content = within(menu as HTMLElement);

    expect(
      content.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual(["Viruses", "Organisms", "Data types"]);

    const expectedItems = [
      ...featuredVirusItems,
      ...browseOrganismItems,
      ...dataTypeItems,
    ];
    const links = content.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      expectedItems.map((item) => item.href),
    );
    expectedItems.forEach((item, index) => {
      expect(links[index]).toHaveAccessibleName(item.title);
    });
  });

  it("no longer offers an Organisms trigger", () => {
    render(
      <AuthBoundary user={null}>
        <DesktopNavbar />
      </AuthBoundary>,
    );

    expect(
      screen.queryByRole("button", { name: "Organisms" }),
    ).not.toBeInTheDocument();
  });
});
