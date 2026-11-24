import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthBoundary } from "@/lib/auth/provider";
import DesktopNavbar from "../desktop-navbar";
import { organismItems } from "../navbar-links";

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

describe("DesktopNavbar Organisms menu", () => {
  it("groups the CEPI taxa under Featured viruses and the browse links under Browse", async () => {
    const user = userEvent.setup();
    render(
      <AuthBoundary user={null}>
        <DesktopNavbar />
      </AuthBoundary>,
    );

    await user.click(screen.getByRole("button", { name: "Organisms" }));

    const first = await screen.findByRole("link", { name: "Bunyaviricetes" });
    const menu = first.closest<HTMLElement>(
      '[data-slot="navigation-menu-content"]',
    );
    expect(menu).not.toBeNull();
    const content = within(menu as HTMLElement);

    expect(
      content.getAllByRole("heading").map((heading) => heading.textContent),
    ).toEqual(["Featured viruses", "Browse"]);

    const links = content.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      organismItems.map((item) => item.href),
    );
    organismItems.forEach((item, index) => {
      expect(links[index]).toHaveAccessibleName(item.title);
    });
  });
});
