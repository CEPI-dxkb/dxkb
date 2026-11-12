import { act, fireEvent, render, screen } from "@testing-library/react";
import { playTuck } from "@/lib/copilot/tuck";
import type { CopilotTabPlacement } from "@/lib/ui-preferences/definitions";
import { CopilotFloatingWindow } from "../copilot-floating-window";

const setSaved = vi.fn();
const saved = { right: 24, bottom: 24, width: 420, height: 640 };

vi.mock("@/lib/ui-preferences/provider", () => ({
  useUiPreference: () => [saved, setSaved],
}));

vi.mock("@/lib/copilot/tuck", () => ({ playTuck: vi.fn(() => null) }));

vi.mock("../copilot-panel", () => ({
  CopilotPanel: ({
    onHeaderPointerDown,
  }: {
    onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  }) => (
    <div data-testid="header" onPointerDown={onHeaderPointerDown}>
      header <input aria-label="field" />
    </div>
  ),
}));

const rightEdge: CopilotTabPlacement = { side: "right", top: 0.75 };
const leftEdge: CopilotTabPlacement = { side: "left", top: 0.75 };

function renderWindow(
  props: Partial<Parameters<typeof CopilotFloatingWindow>[0]> = {},
) {
  const onClose = vi.fn();
  const view = render(
    <CopilotFloatingWindow
      edge={rightEdge}
      minimized={false}
      onMinimize={vi.fn()}
      onClose={onClose}
      {...props}
    />,
  );
  return { ...view, onClose, dialog: screen.getByRole("dialog") };
}

function drag(target: HTMLElement, dx: number, dy: number) {
  fireEvent.pointerDown(target, { button: 0, clientX: 500, clientY: 500 });
  act(() => {
    fireEvent.pointerMove(target, { clientX: 500 + dx, clientY: 500 + dy });
    fireEvent.pointerUp(target);
  });
}

describe("CopilotFloatingWindow", () => {
  beforeEach(() => {
    window.innerWidth = 1400;
    window.innerHeight = 900;
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  it("saves the moved rect when pointerup follows the last move at once", () => {
    renderWindow();
    drag(screen.getByTestId("header"), -50, -20);
    expect(setSaved).toHaveBeenCalledTimes(1);
    expect(setSaved).toHaveBeenCalledWith({ ...saved, right: 74, bottom: 44 });
  });

  it("does not save a press that never moved", () => {
    renderWindow();
    const header = screen.getByTestId("header");
    fireEvent.pointerDown(header, { button: 0, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(header);
    expect(setSaved).not.toHaveBeenCalled();
  });

  it("hangs off the left edge when the tab is there, measuring its offset from the left", () => {
    const { dialog } = renderWindow({ edge: leftEdge });
    expect(dialog).toHaveClass("left-(--copilot-right)");
    expect(dialog).not.toHaveClass("right-(--copilot-right)");

    // Dragging right moves it away from the left edge.
    drag(screen.getByTestId("header"), 50, 0);
    expect(setSaved).toHaveBeenCalledWith({ ...saved, right: 74 });
  });

  it("widens from its inner edge on the left without moving its outer edge", () => {
    const { container } = renderWindow({ edge: leftEdge });
    const handle = container.querySelector<HTMLElement>('[data-resize-handle="e"]');
    if (!handle) throw new Error("no east handle");
    drag(handle, 60, 0);
    expect(setSaved).toHaveBeenCalledWith({ ...saved, width: 480 });
  });

  it("stays mounted but hidden and inert while minimized, and tucks into the tab", () => {
    const { dialog, rerender } = renderWindow();
    expect(dialog).not.toHaveAttribute("inert");

    rerender(
      <CopilotFloatingWindow
        edge={rightEdge}
        minimized
        onMinimize={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(dialog).toHaveAttribute("inert");
    expect(dialog).toHaveClass("pointer-events-none", "invisible");
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(playTuck).toHaveBeenCalledTimes(1);
    const [element, , direction] = vi.mocked(playTuck).mock.calls[0];
    expect(element).toBe(dialog);
    expect(direction).toBe("minimize");
  });

  it("closes on Escape pressed inside it", () => {
    const { onClose } = renderWindow();
    fireEvent.keyDown(screen.getByRole("textbox", { name: "field" }), {
      key: "Escape",
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
