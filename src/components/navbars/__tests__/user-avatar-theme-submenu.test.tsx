import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeProvider } from "@/components/theme-provider";

// The real dropdown menu and theme options: for a signed-in user (desktop and
// mobile navbars alike) this submenu is the only theme control, so the test
// drives the whole path from the avatar to a stored theme.

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({
    user: { id: "alice", username: "alice", email: "alice@example.com" },
    isAdmin: false,
    isImpersonating: false,
  }),
  useExitImpersonation: () => vi.fn(),
  useResendVerificationEmail: () => vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/auth/signout-button", () => ({
  SignoutButton: () => null,
}));

vi.mock("@/components/auth/su-login-dialog", () => ({
  SuLoginDialog: () => null,
}));

import { UserAvatarDropdown } from "../user-avatar-dropdown";

type User = ReturnType<typeof userEvent.setup>;

/**
 * A touch tap, as on a phone. A mouse click would also hover: every element is
 * zero-sized in jsdom, so moving the mouse onto a submenu item reads as leaving
 * the submenu and Base UI closes it before the click lands. A real browser
 * keeps it open.
 */
async function tap(user: User, target: Element) {
  await user.pointer({ keys: "[TouchA]", target });
}

/** Moves menu focus down until it reaches `target`. */
async function arrowDownTo(user: User, target: Element) {
  for (let step = 0; step < 10 && document.activeElement !== target; step++) {
    await user.keyboard("{ArrowDown}");
  }
  expect(target).toHaveFocus();
}

async function openThemeSubmenu() {
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <UserAvatarDropdown />
    </ThemeProvider>,
  );

  await tap(user, screen.getByText("A"));
  const menu = await screen.findByRole("menu");
  await tap(user, within(menu).getByRole("menuitem", { name: "Theme" }));
  await screen.findByRole("group", { name: "Theme" });
  return user;
}

describe("UserAvatarDropdown theme submenu", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    // next-themes watches prefers-color-scheme; jsdom has no matchMedia.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens from the avatar menu with the current theme checked", async () => {
    localStorage.setItem("theme", "bvbrc-dark");
    await openThemeSubmenu();

    expect(
      screen.getByRole("menuitemradio", { name: "BV-BRC" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("applies a tapped theme and mode, staying open between taps", async () => {
    const user = await openThemeSubmenu();

    await tap(user, screen.getByRole("menuitemradio", { name: "Violet" }));
    expect(localStorage.getItem("theme")).toBe("violet-light");
    expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "violet-light",
    );

    await tap(user, screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(localStorage.getItem("theme")).toBe("violet-dark");
    expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "violet-dark",
    );
    expect(
      screen.getByRole("menuitemradio", { name: "Violet" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("is reachable and usable from the keyboard", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <UserAvatarDropdown />
      </ThemeProvider>,
    );

    await user.tab();
    await user.keyboard("{Enter}");
    const menu = await screen.findByRole("menu");
    await arrowDownTo(
      user,
      within(menu).getByRole("menuitem", { name: "Theme" }),
    );
    await user.keyboard("{ArrowRight}");
    await screen.findByRole("group", { name: "Theme" });

    await arrowDownTo(
      user,
      screen.getByRole("menuitemradio", { name: "Dark" }),
    );
    await user.keyboard("{Enter}");
    expect(localStorage.getItem("theme")).toBe("dxkb-dark");

    await arrowDownTo(
      user,
      screen.getByRole("menuitemradio", { name: "Violet" }),
    );
    await user.keyboard("{Enter}");
    expect(localStorage.getItem("theme")).toBe("violet-dark");
    expect(document.documentElement).toHaveAttribute(
      "data-theme",
      "violet-dark",
    );
  });
});
