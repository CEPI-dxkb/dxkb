import { act, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import {
  WorkspacePanelProvider,
  useWorkspacePanel,
} from "@/contexts/workspace-panel-context";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import {
  panelShares,
  pressOnSeparator,
  stubResizableGeometry,
} from "@/test-helpers/resizable";
import { WorkspaceShell } from "../workspace-shell";

stubResizableGeometry();

// clearMocks is set but not restoreMocks; restore so a failing assertion cannot leave
// document.cookie spied.
afterEach(() => {
  vi.restoreAllMocks();
});

let openPanel: () => void = () => undefined;
function OpenPanelHandle() {
  const { setPanelExpanded } = useWorkspacePanel();
  useEffect(() => {
    openPanel = () => {
      setPanelExpanded(true);
    };
  }, [setPanelExpanded]);
  return null;
}

function createShellWrapper(savedLayout?: Record<string, number>) {
  const PreferencesWrapper = createUiPreferencesWrapper(
    savedLayout
      ? {
          workspacePanelLayout: {
            "workspace-main": savedLayout["workspace-main"],
            "workspace-details": savedLayout["workspace-details"],
          },
        }
      : {},
  );
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <PreferencesWrapper>
        <WorkspacePanelProvider>
          <OpenPanelHandle />
          {children}
        </WorkspacePanelProvider>
      </PreferencesWrapper>
    );
  };
}

const shell = (
  <WorkspaceShell actionBar={<span>Actions</span>} selectedItems={[]}>
    <span>Files</span>
  </WorkspaceShell>
);

function renderShell(savedLayout?: Record<string, number>) {
  return render(shell, { wrapper: createShellWrapper(savedLayout) });
}

describe("WorkspaceShell layout persistence", () => {
  it("paints the details panel closed before hydration", () => {
    const Wrapper = createShellWrapper({
      "workspace-main": 30,
      "workspace-details": 70,
    });
    const serverHtml = document.createElement("div");
    serverHtml.innerHTML = renderToString(<Wrapper>{shell}</Wrapper>);
    // Before hydration the library writes no flex-grow for a zero share, so the panel
    // falls back to defaultSize as flex-basis and the initial flex-grow of 0 keeps it at
    // zero width.
    expect(panelShares(serverHtml)).toStrictEqual(["100", ""]);
    expect(
      serverHtml.querySelector<HTMLElement>("#workspace-details")?.style
        .flexBasis,
    ).toBe("0%");
  });

  it("opens the details panel at the saved width", () => {
    renderShell({ "workspace-main": 30, "workspace-details": 70 });
    expect(panelShares()).toStrictEqual(["100", "0"]);
    act(() => {
      openPanel();
    });
    expect(panelShares()).toStrictEqual(["30", "70"]);
  });

  it("saves a user resize, not the mount-time layout", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    renderShell();
    act(() => {
      openPanel();
    });
    expect(
      cookieSpy.mock.calls.some(([value]) =>
        value.startsWith("dxkb-workspace-panel-layout="),
      ),
    ).toBe(false);

    pressOnSeparator("ArrowLeft");
    expect(panelShares()).toStrictEqual(["55", "45"]);
    expect(cookieSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `dxkb-workspace-panel-layout=${encodeURIComponent('{"workspace-main":55,"workspace-details":45}')}`,
      ),
    );
  });

  it("reopens at the saved width after the user drags the panel shut", () => {
    const cookieSpy = vi.spyOn(document, "cookie", "set");
    renderShell();
    act(() => {
      openPanel();
    });
    pressOnSeparator("ArrowLeft");
    pressOnSeparator("End");
    expect(panelShares()).toStrictEqual(["100", "0"]);
    const layoutWrites = cookieSpy.mock.calls
      .map(([value]) => value.split(";")[0])
      .filter((pair) => pair.startsWith("dxkb-workspace-panel-layout="));
    expect(layoutWrites).toStrictEqual([
      `dxkb-workspace-panel-layout=${encodeURIComponent('{"workspace-main":55,"workspace-details":45}')}`,
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(panelShares()).toStrictEqual(["55", "45"]);
  });
});
