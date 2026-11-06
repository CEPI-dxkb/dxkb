import { act, fireEvent, render, screen } from "@testing-library/react";
import { CopilotFloatingWindow } from "../copilot-floating-window";

const setSaved = vi.fn();
const saved = { right: 24, bottom: 24, width: 420, height: 640 };

vi.mock("@/lib/ui-preferences/provider", () => ({
  useUiPreference: () => [saved, setSaved],
}));

vi.mock("../copilot-panel", () => ({
  CopilotPanel: ({
    onHeaderPointerDown,
  }: {
    onHeaderPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  }) => (
    <div data-testid="header" onPointerDown={onHeaderPointerDown}>
      header
    </div>
  ),
}));

describe("CopilotFloatingWindow", () => {
  beforeEach(() => {
    setSaved.mockClear();
    window.innerWidth = 1400;
    window.innerHeight = 900;
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  it("saves the moved rect when pointerup follows the last move at once", () => {
    render(<CopilotFloatingWindow onClose={vi.fn()} />);
    const header = screen.getByTestId("header");
    fireEvent.pointerDown(header, { button: 0, clientX: 500, clientY: 500 });
    act(() => {
      fireEvent.pointerMove(header, { clientX: 450, clientY: 480 });
      fireEvent.pointerUp(header);
    });
    expect(setSaved).toHaveBeenCalledTimes(1);
    expect(setSaved).toHaveBeenCalledWith({ ...saved, right: 74, bottom: 44 });
  });

  it("does not save a press that never moved", () => {
    render(<CopilotFloatingWindow onClose={vi.fn()} />);
    const header = screen.getByTestId("header");
    fireEvent.pointerDown(header, { button: 0, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(header);
    expect(setSaved).not.toHaveBeenCalled();
  });
});
