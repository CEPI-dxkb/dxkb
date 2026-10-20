import { render, screen } from "@testing-library/react";
import type { AuthUser } from "@/lib/auth/types";
import { AuthBoundary } from "@/lib/auth/provider";
import DesktopNavbar from "../desktop-navbar";

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

const unverifiedUser: AuthUser = {
  id: "alice@patricbrc.org",
  username: "alice@patricbrc.org",
  email: "",
  realm: "patricbrc.org",
  roles: [],
  sessionUnverified: true,
  sessionUnverifiedReason: "The account service could not be reached.",
};

describe("DesktopNavbar for a session the profile service could not verify", () => {
  it("keeps the account menu and explains the outage instead of offering Sign In", () => {
    render(
      <AuthBoundary user={unverifiedUser}>
        <DesktopNavbar />
      </AuthBoundary>,
    );

    expect(
      screen.getByRole("button", { name: "Account menu" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Sign In" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /couldn.t verify your account/i }),
    ).toHaveTextContent("The account service could not be reached.");
  });
});
