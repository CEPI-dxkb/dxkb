import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import type { CopilotMessage } from "@/lib/copilot/types";
import type { UiPreferences } from "@/lib/ui-preferences/definitions";
import { server } from "@/test-helpers/msw-server";
import {
  createQueryClientWrapper,
  createUiPreferencesWrapper,
} from "@/test-helpers/react";
import { CopilotDockShell } from "../copilot-dock-shell";
import { CopilotEdgeTab } from "../copilot-edge-tab";
import { useCopilot } from "../copilot-provider";
import { CopilotSideDock } from "../copilot-side-dock";
import { CopilotSurfaces } from "../copilot-surfaces";
import { fakeCopilot, type CopilotValue } from "./fixtures/fake-copilot";

vi.mock("../copilot-provider", () => ({ useCopilot: vi.fn() }));
// Both lazy surfaces (the panel in the side dock, the floating window) render as this stub: a
// composer, and a control portaled out of the panel the way the header's menus are.
vi.mock("next/dynamic", async () => {
  const { createPortal } = await import("react-dom");
  return {
    default: () =>
      function LazySurface(props: { variant?: string; minimized?: boolean }) {
        return (
          <div
            data-testid="lazy"
            data-variant={props.variant ?? "floating-window"}
            data-minimized={String(props.minimized ?? "")}
          >
            <textarea aria-label="Ask AskClark" data-copilot-composer="" />
            {createPortal(<button type="button">Portaled menu item</button>, document.body)}
          </div>
        );
      },
  };
});

function answer(content: string): CopilotMessage {
  return {
    id: "a1",
    role: "assistant",
    content,
    timestamp: null,
    model: null,
    steps: [],
    card: null,
    rating: null,
    persisted: true,
    systemInitiated: false,
    isClarification: false,
    clarificationAnswers: [],
    attachments: [],
  };
}

function wrapper(preferences: Partial<UiPreferences> = {}) {
  const Query = createQueryClientWrapper();
  const Preferences = createUiPreferencesWrapper(preferences);
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Query>
        <Preferences>{children}</Preferences>
      </Query>
    );
  };
}

function renderApp(copilot: Partial<CopilotValue>, preferences: Partial<UiPreferences> = {}) {
  vi.mocked(useCopilot).mockReturnValue(fakeCopilot(copilot));
  const view = render(
    <CopilotDockShell>
      <main>page</main>
      <CopilotSurfaces />
    </CopilotDockShell>,
    { wrapper: wrapper(preferences) },
  );
  return { ...view, shell: view.container.firstElementChild as HTMLElement };
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        this.callback();
      }
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  server.use(
    http.get("*/api/copilot/sessions/:id", () =>
      HttpResponse.json({
        sessionId: "s1",
        messages: [answer("I found **12** genomes.")],
        executionMode: "plan",
        activeJobId: null,
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.getElementById("navbar-container")?.remove();
});

function mountNavbar(bottom: { value: number }) {
  const navbar = document.createElement("div");
  navbar.id = "navbar-container";
  navbar.getBoundingClientRect = () => ({ bottom: bottom.value }) as DOMRect;
  document.body.append(navbar);
  return navbar;
}

describe("CopilotSurfaces and CopilotDockShell", () => {
  it("draws nothing and pushes nothing while the chat is closed", () => {
    const { shell } = renderApp({ openSurface: null });
    expect(shell).not.toHaveAttribute("data-dock");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByTestId("lazy")).toBeNull();
  });

  it("docks the side panel under the navbar, on the tab's side, pushing the page", () => {
    mountNavbar({ value: 64 });

    const { shell } = renderApp({}, { copilotTab: { side: "left", top: 0.5 } });
    expect(shell).toHaveAttribute("data-dock", "left");
    expect(shell.style.getPropertyValue("--dock-top")).toBe("64px");
    const dock = screen.getByRole("complementary", { name: "AskClark" });
    expect(dock).toHaveClass("left-0", "w-(--dock-width)", "max-w-full");
    expect(dock).not.toHaveAttribute("data-closed");
    expect(screen.getByTestId("lazy")).toHaveAttribute("data-variant", "sheet");
    expect(screen.queryByRole("button", { name: "Restore AskClark" })).toBeNull();
  });

  it("keeps a minimized side panel mounted but inert, gives the page its room back, and shows the tab", () => {
    const { shell, container } = renderApp({ minimized: true });
    expect(shell).not.toHaveAttribute("data-dock");
    const dock = container.querySelector("aside");
    expect(dock).toHaveAttribute("data-closed");
    expect(dock).toHaveClass("w-0");
    expect(screen.getByTestId("lazy").parentElement).toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Restore AskClark" })).toBeInTheDocument();
  });

  it("shows the floating window without pushing the page, minimized with the tab", () => {
    const { shell } = renderApp({ openSurface: "floating", minimized: true });
    expect(shell).not.toHaveAttribute("data-dock");
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByTestId("lazy")).toHaveAttribute("data-minimized", "true");
    expect(screen.getByRole("button", { name: "Restore AskClark" })).toBeInTheDocument();
  });
});

describe("CopilotDockShell navbar tracking", () => {
  it("moves the docks' top with the navbar while scrolling, once per frame, and stops on unmount", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const bottom = { value: 64 };
    mountNavbar(bottom);
    const { shell, unmount } = renderApp({});
    expect(shell.style.getPropertyValue("--dock-top")).toBe("64px");

    bottom.value = 20.4;
    fireEvent.scroll(window);
    fireEvent.scroll(window);
    expect(frames).toHaveLength(1);
    act(() => {
      frames.shift()?.(0);
    });
    expect(shell.style.getPropertyValue("--dock-top")).toBe("20px");

    // Scrolled past the navbar: the docks reach the top of the window.
    bottom.value = -80;
    fireEvent.scroll(window);
    act(() => {
      frames.shift()?.(0);
    });
    expect(shell.style.getPropertyValue("--dock-top")).toBe("0px");

    unmount();
    fireEvent.scroll(window);
    expect(frames).toHaveLength(0);
  });

  it("follows a navbar that navigation replaced, not the detached one", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => frames.push(callback)),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const oldNavbar = mountNavbar({ value: 72 });
    const { shell } = renderApp({});
    expect(shell.style.getPropertyValue("--dock-top")).toBe("72px");

    // A detached element measures as zero; the new layout's navbar is 56px tall.
    oldNavbar.remove();
    oldNavbar.getBoundingClientRect = () => ({ bottom: 0 }) as DOMRect;
    mountNavbar({ value: 56 });
    fireEvent.scroll(window);
    act(() => {
      frames.shift()?.(0);
    });
    expect(shell.style.getPropertyValue("--dock-top")).toBe("56px");
  });
});

describe("CopilotSideDock", () => {
  function renderDock(minimized = false) {
    const onClose = vi.fn();
    const props = { side: "right" as const, onMinimize: vi.fn(), onClose };
    const view = render(<CopilotSideDock {...props} minimized={minimized} />);
    const rerender = (next: boolean) => {
      view.rerender(<CopilotSideDock {...props} minimized={next} />);
    };
    return { ...view, rerender, onClose };
  }

  function composer() {
    return screen.getByRole("textbox", { name: "Ask AskClark" });
  }

  it("focuses the composer when it opens, and not again on a re-render", () => {
    const outside = document.createElement("button");
    document.body.append(outside);
    const { rerender } = renderDock();
    expect(composer()).toHaveFocus();

    outside.focus();
    rerender(false);
    expect(outside).toHaveFocus();
    outside.remove();
  });

  it("focuses the composer again when restored", () => {
    const { rerender } = renderDock();
    rerender(true);
    composer().blur();
    rerender(false);
    expect(composer()).toHaveFocus();
  });

  it("closes on Escape pressed inside it", () => {
    const { onClose } = renderDock();
    fireEvent.keyDown(composer(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape to a menu that handled it, or that is portaled out of the panel", () => {
    const { onClose } = renderDock();
    const box = composer();
    box.addEventListener("keydown", (event) => {
      event.preventDefault();
    });
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Portaled menu item" }), {
      key: "Escape",
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("CopilotEdgeTab", () => {
  function renderTab(copilot: Partial<CopilotValue> = {}) {
    const value = fakeCopilot({ minimized: true, ...copilot });
    vi.mocked(useCopilot).mockReturnValue(value);
    const onPlace = vi.fn();
    render(<CopilotEdgeTab placement={{ side: "right", top: 0.5 }} onPlace={onPlace} />, {
      wrapper: wrapper(),
    });
    const tab = screen.getByRole("button", { name: "Restore AskClark" });
    return { tab, onPlace, copilot: value };
  }

  beforeEach(() => {
    window.innerWidth = 1000;
    window.innerHeight = 800;
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  it("restores on click and previews the newest answer in its tooltip", async () => {
    const { tab, copilot } = renderTab();
    expect(tab).toHaveAttribute("aria-keyshortcuts", "ArrowUp ArrowDown ArrowLeft ArrowRight");
    expect(await screen.findByTitle("I found 12 genomes. Drag to move.")).toBe(tab);
    await userEvent.click(tab);
    expect(copilot.restore).toHaveBeenCalledTimes(1);
  });

  it("says an answer is ready after a turn ran while minimized", () => {
    const { tab } = renderTab({ unread: true });
    expect(tab).toHaveAttribute("title", "AskClark: answer ready. Drag to move.");
  });

  it("takes focus when minimizing left it on the panel that went inert", () => {
    const panel = document.createElement("div");
    panel.setAttribute("inert", "");
    const inside = document.createElement("button");
    panel.append(inside);
    document.body.append(panel);
    inside.focus();

    const { tab } = renderTab();
    expect(tab).toHaveFocus();
    panel.remove();
  });

  it("leaves focus where it is when the navbar button minimized the chat", () => {
    const navbarButton = document.createElement("button");
    document.body.append(navbarButton);
    navbarButton.focus();

    const { tab } = renderTab();
    expect(tab).not.toHaveFocus();
    expect(navbarButton).toHaveFocus();
    navbarButton.remove();
  });

  it("moves with the arrow keys", () => {
    const { tab, onPlace } = renderTab();
    expect(fireEvent.keyDown(tab, { key: "ArrowUp" })).toBe(false);
    expect(onPlace).toHaveBeenLastCalledWith({ side: "right", top: 0.45 });
    fireEvent.keyDown(tab, { key: "ArrowLeft" });
    expect(onPlace).toHaveBeenLastCalledWith({ side: "left", top: 0.5 });
    expect(fireEvent.keyDown(tab, { key: "Enter" })).toBe(true);
    expect(onPlace).toHaveBeenCalledTimes(2);
  });

  it("snaps a drag to the nearer side, and the click that ends it does not restore", () => {
    const { tab, onPlace, copilot } = renderTab();
    fireEvent.pointerDown(tab, { button: 0, clientX: 990, clientY: 400 });
    fireEvent.pointerMove(tab, { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(tab, { clientX: 300, clientY: 200 });
    fireEvent.click(tab);
    expect(onPlace).toHaveBeenCalledWith({ side: "left", top: 0.25 });
    expect(copilot.restore).not.toHaveBeenCalled();
  });
});
