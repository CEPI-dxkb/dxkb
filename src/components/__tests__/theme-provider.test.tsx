import { render } from "@testing-library/react";

import { ThemeProvider } from "@/components/theme-provider";

/**
 * The pre-paint script's source, taken from a render with nothing stored so
 * the provider's own after-load reset cannot do the script's work.
 */
function prePaintScriptSource() {
  const { container, unmount } = render(<ThemeProvider />);
  const source = container.querySelector("script")?.textContent ?? "";
  unmount();
  return source;
}

/**
 * React never executes a script it renders on the client, so run the source
 * the way the browser runs it from the server HTML: as a fresh script element.
 */
function runScript(source: string) {
  const script = document.createElement("script");
  script.textContent = source;
  document.body.append(script);
  script.remove();
}

describe("ThemeProvider pre-paint script", () => {
  beforeEach(() => {
    localStorage.clear();
    // next-themes watches prefers-color-scheme; jsdom has no matchMedia.
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["zinc-dark", "dxkb-dark"],
    ["orange-light", "dxkb-light"],
    ["system", "dxkb-light"],
  ])("rewrites the stored %s to %s", (stored, expected) => {
    const source = prePaintScriptSource();
    localStorage.setItem("theme", stored);
    runScript(source);
    expect(localStorage.getItem("theme")).toBe(expected);
  });

  it("leaves an offered theme alone", () => {
    const source = prePaintScriptSource();
    localStorage.setItem("theme", "violet-dark");
    runScript(source);
    expect(localStorage.getItem("theme")).toBe("violet-dark");
  });

  it("stores nothing when no theme is stored", () => {
    runScript(prePaintScriptSource());
    expect(localStorage.getItem("theme")).toBeNull();
  });
});
