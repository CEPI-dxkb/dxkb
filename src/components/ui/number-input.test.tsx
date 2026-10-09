import { createRef } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { NumberInput } from "./number-input";

function getInput(name: string) {
  return screen.getByRole("textbox", { name });
}

describe("NumberInput", () => {
  describe("refs and keyboard routing", () => {
    it("handles arrow keys when no ref is provided", () => {
      render(<NumberInput aria-label="Quantity" defaultValue={1} />);

      const input = getInput("Quantity");
      input.focus();

      fireEvent.keyDown(window, { key: "ArrowUp" });
      expect(input).toHaveValue("2");

      fireEvent.keyDown(window, { key: "ArrowDown" });
      expect(input).toHaveValue("1");
    });

    it("forwards the input element to an object ref and clears it on unmount", () => {
      const ref = createRef<HTMLInputElement>();
      const { unmount } = render(
        <NumberInput ref={ref} aria-label="Quantity" />,
      );

      expect(ref.current).toBe(getInput("Quantity"));

      unmount();
      expect(ref.current).toBeNull();
    });

    it("forwards mount and unmount to a callback ref", () => {
      const ref = vi.fn<(node: HTMLInputElement | null) => void>();
      const { unmount } = render(
        <NumberInput ref={ref} aria-label="Quantity" />,
      );
      const input = getInput("Quantity");

      expect(ref).toHaveBeenCalledWith(input);

      unmount();
      expect(ref).toHaveBeenLastCalledWith(null);
    });

    it("only changes the focused NumberInput", () => {
      render(
        <>
          <NumberInput aria-label="First quantity" defaultValue={1} />
          <NumberInput aria-label="Second quantity" defaultValue={10} />
        </>,
      );
      const first = getInput("First quantity");
      const second = getInput("Second quantity");

      second.focus();
      fireEvent.keyDown(window, { key: "ArrowUp" });

      expect(first).toHaveValue("1");
      expect(second).toHaveValue("11");
    });

    it("ignores arrow keys when the input is not focused", () => {
      render(<NumberInput aria-label="Quantity" defaultValue={1} />);

      fireEvent.keyDown(window, { key: "ArrowUp" });

      expect(getInput("Quantity")).toHaveValue("1");
    });

    it("ignores keys other than ArrowUp and ArrowDown", () => {
      render(<NumberInput aria-label="Quantity" defaultValue={1} />);
      const input = getInput("Quantity");
      input.focus();

      fireEvent.keyDown(window, { key: "Enter" });

      expect(input).toHaveValue("1");
    });

    it("removes its global keyboard listener when unmounted", () => {
      const removeEventListener = vi.spyOn(window, "removeEventListener");
      const { unmount } = render(
        <NumberInput aria-label="Quantity" defaultValue={1} />,
      );

      unmount();

      expect(removeEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
      );
      expect(() =>
        fireEvent.keyDown(window, { key: "ArrowUp" }),
      ).not.toThrow();
    });
  });

  describe("stepping and limits", () => {
    it("uses the configured step for keyboard and button controls", () => {
      render(
        <NumberInput aria-label="Coverage" defaultValue={100} stepper={50} />,
      );
      const input = getInput("Coverage");
      input.focus();

      fireEvent.keyDown(window, { key: "ArrowUp" });
      expect(input).toHaveValue("150");

      fireEvent.mouseDown(screen.getByRole("button", { name: "Increase value" }));
      fireEvent.mouseUp(screen.getByRole("button", { name: "Increase value" }));
      expect(input).toHaveValue("200");

      fireEvent.mouseDown(screen.getByRole("button", { name: "Decrease value" }));
      fireEvent.mouseUp(screen.getByRole("button", { name: "Decrease value" }));
      expect(input).toHaveValue("150");
    });

    it("starts an empty value at one positive or negative step", () => {
      const { rerender } = render(
        <NumberInput aria-label="Quantity" stepper={5} />,
      );
      const input = getInput("Quantity");
      input.focus();

      fireEvent.keyDown(window, { key: "ArrowUp" });
      expect(input).toHaveValue("5");

      rerender(<NumberInput aria-label="Quantity" stepper={5} />);
      fireEvent.change(input, { target: { value: "" } });
      fireEvent.keyDown(window, { key: "ArrowDown" });
      expect(input).toHaveValue("-5");
    });

    it("repeats while a step button is held and stops on release", async () => {
      vi.useFakeTimers();
      try {
        render(<NumberInput aria-label="Quantity" defaultValue={1} />);
        const input = getInput("Quantity");
        const increase = screen.getByRole("button", { name: "Increase value" });

        fireEvent.mouseDown(increase);
        await act(() => vi.advanceTimersByTime(600));
        const heldValue = Number(input.getAttribute("value"));
        expect(heldValue).toBeGreaterThan(2);

        fireEvent.mouseUp(increase);
        await act(() => vi.advanceTimersByTime(1000));
        expect(input).toHaveValue(String(heldValue));
      } finally {
        vi.useRealTimers();
      }
    });

    it("clamps keyboard stepping and disables controls at min and max", () => {
      render(
        <NumberInput
          aria-label="Iterations"
          defaultValue={3}
          min={0}
          max={4}
          stepper={2}
        />,
      );
      const input = getInput("Iterations");
      const increase = screen.getByRole("button", { name: "Increase value" });
      const decrease = screen.getByRole("button", { name: "Decrease value" });
      input.focus();

      fireEvent.keyDown(window, { key: "ArrowUp" });
      expect(input).toHaveValue("4");
      expect(increase).toBeDisabled();

      fireEvent.keyDown(window, { key: "ArrowDown" });
      fireEvent.keyDown(window, { key: "ArrowDown" });
      expect(input).toHaveValue("0");
      expect(decrease).toBeDisabled();
    });

    it("clamps typed values to min and max on blur without a forwarded ref", () => {
      render(
        <NumberInput aria-label="Iterations" min={-2} max={4} defaultValue={2} />,
      );
      const input = getInput("Iterations");

      fireEvent.change(input, { target: { value: "9" } });
      fireEvent.blur(input);
      expect(input).toHaveValue("4");

      fireEvent.change(input, { target: { value: "-3" } });
      fireEvent.blur(input);
      expect(input).toHaveValue("-2");
    });
  });

  describe("values and formatting", () => {
    it("reports keyboard and button stepping in order", () => {
      const onValueChange = vi.fn();
      render(
        <NumberInput
          aria-label="Quantity"
          defaultValue={1}
          onValueChange={onValueChange}
        />,
      );
      const input = getInput("Quantity");
      input.focus();

      fireEvent.keyDown(window, { key: "ArrowUp" });
      fireEvent.mouseDown(
        screen.getByRole("button", { name: "Increase value" }),
      );
      fireEvent.mouseUp(screen.getByRole("button", { name: "Increase value" }));

      expect(input).toHaveValue("3");
      expect(onValueChange.mock.calls).toEqual([[2], [3]]);
    });

    it("reports typed numbers and empty values", () => {
      const onValueChange = vi.fn();
      render(
        <NumberInput aria-label="Quantity" onValueChange={onValueChange} />,
      );
      const input = getInput("Quantity");

      fireEvent.change(input, { target: { value: "42" } });
      expect(input).toHaveValue("42");
      expect(onValueChange).toHaveBeenLastCalledWith(42);

      fireEvent.change(input, { target: { value: "" } });
      expect(input).toHaveValue("");
      expect(onValueChange).toHaveBeenLastCalledWith(undefined);
    });

    it("updates when its controlled value changes", () => {
      const { rerender } = render(
        <NumberInput aria-label="Quantity" value={1} />,
      );

      rerender(<NumberInput aria-label="Quantity" value={7} />);

      expect(getInput("Quantity")).toHaveValue("7");
    });

    it("renders separators, prefix, suffix, and fixed decimals", () => {
      render(
        <NumberInput
          aria-label="Price"
          value={1234.5}
          thousandSeparator=","
          prefix="$"
          suffix=" USD"
          decimalScale={2}
          fixedDecimalScale
        />,
      );

      expect(getInput("Price")).toHaveValue("$1,234.50 USD");
    });
  });
});

describe("NumberInput stepper arrows", () => {
  it("wraps the input and both arrows in one number-input slot", () => {
    // globals.css hovers the whole field (border round the arrows too) from
    // this slot, so the input and arrows must stay inside it.
    const { container } = render(
      <NumberInput aria-label="Iterations" defaultValue={2} min={0} max={4} />,
    );
    const slot = container.querySelector('[data-slot="number-input"]');

    expect(slot).toContainElement(getInput("Iterations"));
    expect(slot).toContainElement(
      screen.getByRole("button", { name: "Increase value" }),
    );
    expect(slot).toContainElement(
      screen.getByRole("button", { name: "Decrease value" }),
    );
  });

  it("draws each arrow as a stepper button, disabled at its limit", () => {
    render(<NumberInput aria-label="Iterations" value={4} min={0} max={4} />);
    const up = screen.getByRole("button", { name: "Increase value" });
    const down = screen.getByRole("button", { name: "Decrease value" });

    expect(up).toHaveAttribute("data-variant", "stepper");
    expect(down).toHaveAttribute("data-variant", "stepper");
    expect(up).toBeDisabled();
    expect(down).toBeEnabled();
  });
});
