import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaneResizeHandle } from "@/components/workspace/folder-picker/folder-picker-resize-handle";

const limits = { min: 144, max: 480, initial: 180 };

// jsdom has no pointer capture.
const setPointerCapture = vi.fn();
const releasePointerCapture = vi.fn();
Element.prototype.setPointerCapture = setPointerCapture;
Element.prototype.releasePointerCapture = releasePointerCapture;

function Harness({
  edge,
  startWidth = 200,
  onResize,
  onParentKeyDown,
}: {
  edge: "start" | "end";
  startWidth?: number;
  onResize?: (width: number) => void;
  onParentKeyDown?: () => void;
}) {
  const [width, setWidth] = useState(startWidth);
  return (
    <div onKeyDown={onParentKeyDown}>
      <PaneResizeHandle
        edge={edge}
        label="Resize Home column"
        width={width}
        limits={limits}
        onResize={(next) => {
          onResize?.(next);
          setWidth(next);
        }}
      />
    </div>
  );
}

function handle() {
  return screen.getByRole("separator", { name: "Resize Home column" });
}

describe("PaneResizeHandle", () => {
  it("describes itself as a vertical separator with its range", () => {
    render(<Harness edge="end" />);

    expect(handle()).toHaveAttribute("aria-orientation", "vertical");
    expect(handle()).toHaveAttribute("aria-valuenow", "200");
    expect(handle()).toHaveAttribute("aria-valuemin", "144");
    expect(handle()).toHaveAttribute("aria-valuemax", "480");
    expect(handle()).toHaveAttribute("tabindex", "0");
    expect(handle()).toHaveAttribute(
      "title",
      "Drag to resize · double-click to reset",
    );
  });

  it("widens a pane with → when the handle is on its end edge", async () => {
    const user = userEvent.setup();
    render(<Harness edge="end" />);
    handle().focus();

    await user.keyboard("{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "216");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle()).toHaveAttribute("aria-valuenow", "184");
  });

  it("narrows a pane with → when the handle is on its start edge", async () => {
    const user = userEvent.setup();
    render(<Harness edge="start" />);
    handle().focus();

    await user.keyboard("{ArrowRight}");
    expect(handle()).toHaveAttribute("aria-valuenow", "184");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(handle()).toHaveAttribute("aria-valuenow", "216");
  });

  it("keeps the width within its limits", async () => {
    const user = userEvent.setup();
    render(<Harness edge="end" startWidth={150} />);
    handle().focus();

    await user.keyboard("{ArrowLeft}");
    expect(handle()).toHaveAttribute("aria-valuenow", "144");

    fireEvent.pointerDown(handle(), { button: 0, clientX: 0, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 1000, pointerId: 1 });
    expect(handle()).toHaveAttribute("aria-valuenow", "480");
  });

  it("keeps its arrow keys from the rest of the picker, but not other keys", async () => {
    const user = userEvent.setup();
    const onParentKeyDown = vi.fn();
    const onResize = vi.fn();
    render(
      <Harness
        edge="end"
        onResize={onResize}
        onParentKeyDown={onParentKeyDown}
      />,
    );
    handle().focus();

    await user.keyboard("{ArrowRight}{ArrowLeft}");
    expect(onParentKeyDown).not.toHaveBeenCalled();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(onParentKeyDown).toHaveBeenCalledTimes(2);
    expect(onResize).toHaveBeenCalledTimes(2);
  });

  it("resets to its initial width on double click", async () => {
    const user = userEvent.setup();
    render(<Harness edge="end" startWidth={300} />);

    await user.dblClick(handle());

    expect(handle()).toHaveAttribute("aria-valuenow", "180");
  });

  it("follows a drag from where it started, in whole pixels", () => {
    render(<Harness edge="end" />);

    fireEvent.pointerDown(handle(), { button: 0, clientX: 500, pointerId: 7 });
    expect(setPointerCapture).toHaveBeenCalledWith(7);

    fireEvent.pointerMove(handle(), { clientX: 530.4, pointerId: 7 });
    expect(handle()).toHaveAttribute("aria-valuenow", "230");
    // Relative to the drag's start, not the last move.
    fireEvent.pointerMove(handle(), { clientX: 480, pointerId: 7 });
    expect(handle()).toHaveAttribute("aria-valuenow", "180");

    fireEvent.pointerUp(handle(), { clientX: 480, pointerId: 7 });
    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    fireEvent.pointerMove(handle(), { clientX: 700, pointerId: 7 });
    expect(handle()).toHaveAttribute("aria-valuenow", "180");
  });

  it("drags the other way for a handle on the start edge", () => {
    render(<Harness edge="start" />);

    fireEvent.pointerDown(handle(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 450, pointerId: 1 });

    expect(handle()).toHaveAttribute("aria-valuenow", "250");
  });

  it("ignores a drag with any button but the primary one", () => {
    const onResize = vi.fn();
    render(<Harness edge="end" onResize={onResize} />);

    fireEvent.pointerDown(handle(), { button: 2, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 600, pointerId: 1 });

    expect(onResize).not.toHaveBeenCalled();
    expect(setPointerCapture).not.toHaveBeenCalled();
  });

  it("stops following when the pointer is cancelled", () => {
    render(<Harness edge="end" />);

    fireEvent.pointerDown(handle(), { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerCancel(handle(), { pointerId: 1 });
    fireEvent.pointerMove(handle(), { clientX: 600, pointerId: 1 });

    expect(handle()).toHaveAttribute("aria-valuenow", "200");
  });
});
