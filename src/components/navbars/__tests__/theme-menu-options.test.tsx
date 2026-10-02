import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeProvider } from "@/components/theme-provider";
import { NavbarThemeSwitcher } from "../theme-switcher-navbar";

function renderSwitcher() {
  return render(
    <ThemeProvider>
      <NavbarThemeSwitcher />
    </ThemeProvider>,
  );
}

async function openMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Open theme selector" }));
  await screen.findByRole("menu");
  return user;
}

describe("NavbarThemeSwitcher / ThemeMenuOptions", () => {
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

  it("lists the three themes with the current one checked", async () => {
    localStorage.setItem("theme", "bvbrc-light");
    renderSwitcher();
    await openMenu();

    const themes = screen.getByRole("group", { name: "Theme" });
    const options = Array.from(
      themes.querySelectorAll('[role="menuitemradio"]'),
    ).map((option) => option.textContent);
    expect(options).toEqual(["DXKB", "BV-BRC", "Violet"]);
    expect(screen.getByRole("menuitemradio", { name: "BV-BRC" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("switches the mode and keeps the theme", async () => {
    localStorage.setItem("theme", "violet-light");
    renderSwitcher();
    const user = await openMenu();

    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(
        "data-theme",
        "violet-dark",
      );
    });
    expect(localStorage.getItem("theme")).toBe("violet-dark");
  });

  it("switches the theme and keeps the mode", async () => {
    localStorage.setItem("theme", "dxkb-dark");
    renderSwitcher();
    const user = await openMenu();

    await user.click(screen.getByRole("menuitemradio", { name: "BV-BRC" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(
        "data-theme",
        "bvbrc-dark",
      );
    });
  });

  it("paints each preview with its own theme in the current mode", async () => {
    localStorage.setItem("theme", "dxkb-dark");
    const { baseElement } = renderSwitcher();
    await openMenu();

    const previews = Array.from(
      baseElement.querySelectorAll('[role="menuitemradio"] [data-theme]'),
    ).map((preview) => preview.getAttribute("data-theme"));
    expect(previews).toEqual(["dxkb-dark", "bvbrc-dark", "violet-dark"]);
  });

  it("moves a visitor on a retired theme to DXKB in the same mode", async () => {
    localStorage.setItem("theme", "zinc-dark");
    renderSwitcher();

    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("dxkb-dark");
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dxkb-dark");
  });
});
