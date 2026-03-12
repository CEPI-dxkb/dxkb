import { renderHook, act } from "@testing-library/react";
import { useTableKeyboardNavigation } from "@/hooks/use-table-keyboard-navigation";
import type React from "react";

function createKeyEvent(
  overrides: Partial<React.KeyboardEvent> & { key: string },
): React.KeyboardEvent {
  return {
    key: overrides.key,
    preventDefault: vi.fn(),
    shiftKey: overrides.shiftKey ?? false,
    metaKey: overrides.metaKey ?? false,
    ctrlKey: overrides.ctrlKey ?? false,
  } as unknown as React.KeyboardEvent;
}

describe("useTableKeyboardNavigation", () => {
  const items = ["apple", "banana", "cherry", "date"];

  it("ArrowDown from no selection selects the first item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = -1;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "ArrowDown" });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledWith("apple", {
      ctrlOrMeta: false,
      shift: false,
    });
  });

  it("ArrowDown moves to the next item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = 0;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "ArrowDown" });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onSelect).toHaveBeenCalledWith("banana", {
      ctrlOrMeta: false,
      shift: false,
    });
  });

  it("ArrowUp moves to the previous item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = 2;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "ArrowUp" });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onSelect).toHaveBeenCalledWith("banana", {
      ctrlOrMeta: false,
      shift: false,
    });
  });

  it("ArrowUp at first item stays at first item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = 0;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "ArrowUp" });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onSelect).toHaveBeenCalledWith("apple", {
      ctrlOrMeta: false,
      shift: false,
    });
  });

  it("ArrowDown at last item stays at last item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = 3;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "ArrowDown" });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onSelect).toHaveBeenCalledWith("date", {
      ctrlOrMeta: false,
      shift: false,
    });
  });

  it("Shift+ArrowDown jumps to last item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = 0;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "ArrowDown", shiftKey: true });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onSelect).toHaveBeenCalledWith("date", {
      ctrlOrMeta: false,
      shift: false,
    });
  });

  it("Shift+ArrowUp jumps to first item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = 3;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "ArrowUp", shiftKey: true });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onSelect).toHaveBeenCalledWith("apple", {
      ctrlOrMeta: false,
      shift: false,
    });
  });

  it("Enter calls onEnter with focused item", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = 1;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "Enter" });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onEnter).toHaveBeenCalledWith("banana");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("Enter with no selection does nothing", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = -1;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
      }),
    );

    const event = createKeyEvent({ key: "Enter" });

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(onEnter).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does nothing when disabled", () => {
    const onSelect = vi.fn();
    const onEnter = vi.fn();
    const focusedIndex = -1;

    const { result } = renderHook(() =>
      useTableKeyboardNavigation({
        items,
        getFocusedIndex: () => focusedIndex,
        onSelect,
        onEnter,
        enabled: false,
      }),
    );

    const downEvent = createKeyEvent({ key: "ArrowDown" });
    const enterEvent = createKeyEvent({ key: "Enter" });

    act(() => {
      result.current.handleKeyDown(downEvent);
    });
    act(() => {
      result.current.handleKeyDown(enterEvent);
    });

    expect(onSelect).not.toHaveBeenCalled();
    expect(onEnter).not.toHaveBeenCalled();
    expect(downEvent.preventDefault).not.toHaveBeenCalled();
  });

  describe("with special rows", () => {
    it("ArrowDown navigates through leading row before items", () => {
      const onSelect = vi.fn();
      const onEnter = vi.fn();
      const onClearSelection = vi.fn();
      const focusedIndex = -1;

      const { result } = renderHook(() =>
        useTableKeyboardNavigation({
          items,
          getFocusedIndex: () => focusedIndex,
          onSelect,
          onEnter,
          leadingOffset: 1,
          onClearSelection,
        }),
      );

      // First ArrowDown should focus the leading special row
      const event1 = createKeyEvent({ key: "ArrowDown" });
      act(() => {
        result.current.handleKeyDown(event1);
      });

      expect(result.current.focusedSpecialRow).toBe("leading");
      expect(onClearSelection).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("ArrowDown navigates through parent row after leading row", () => {
      const onSelect = vi.fn();
      const onEnter = vi.fn();
      const onClearSelection = vi.fn();
      const onLeadingEnter = vi.fn();
      const focusedIndex = -1;

      const { result } = renderHook(() =>
        useTableKeyboardNavigation({
          items,
          getFocusedIndex: () => focusedIndex,
          onSelect,
          onEnter,
          leadingOffset: 1,
          parentOffset: 1,
          onClearSelection,
          onLeadingEnter,
        }),
      );

      // First ArrowDown goes to leading row
      act(() => {
        result.current.handleKeyDown(createKeyEvent({ key: "ArrowDown" }));
      });
      expect(result.current.focusedSpecialRow).toBe("leading");

      // Second ArrowDown should go to parent row
      act(() => {
        result.current.handleKeyDown(createKeyEvent({ key: "ArrowDown" }));
      });
      expect(result.current.focusedSpecialRow).toBe("parent");
    });

    it("Enter on leading special row calls onLeadingEnter", () => {
      const onSelect = vi.fn();
      const onEnter = vi.fn();
      const onClearSelection = vi.fn();
      const onLeadingEnter = vi.fn();
      const focusedIndex = -1;

      const { result } = renderHook(() =>
        useTableKeyboardNavigation({
          items,
          getFocusedIndex: () => focusedIndex,
          onSelect,
          onEnter,
          leadingOffset: 1,
          onClearSelection,
          onLeadingEnter,
        }),
      );

      // Navigate to leading row
      act(() => {
        result.current.handleKeyDown(createKeyEvent({ key: "ArrowDown" }));
      });
      expect(result.current.focusedSpecialRow).toBe("leading");

      // Press Enter on leading row
      const enterEvent = createKeyEvent({ key: "Enter" });
      act(() => {
        result.current.handleKeyDown(enterEvent);
      });

      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(onLeadingEnter).toHaveBeenCalled();
      expect(onEnter).not.toHaveBeenCalled();
    });

    it("Enter on parent special row calls onParentEnter", () => {
      const onSelect = vi.fn();
      const onEnter = vi.fn();
      const onClearSelection = vi.fn();
      const onParentEnter = vi.fn();
      const focusedIndex = -1;

      const { result } = renderHook(() =>
        useTableKeyboardNavigation({
          items,
          getFocusedIndex: () => focusedIndex,
          onSelect,
          onEnter,
          parentOffset: 1,
          onClearSelection,
          onParentEnter,
        }),
      );

      // Navigate to parent row (with no leading offset, first ArrowDown goes to parent)
      act(() => {
        result.current.handleKeyDown(createKeyEvent({ key: "ArrowDown" }));
      });
      expect(result.current.focusedSpecialRow).toBe("parent");

      // Press Enter on parent row
      const enterEvent = createKeyEvent({ key: "Enter" });
      act(() => {
        result.current.handleKeyDown(enterEvent);
      });

      expect(enterEvent.preventDefault).toHaveBeenCalled();
      expect(onParentEnter).toHaveBeenCalled();
      expect(onEnter).not.toHaveBeenCalled();
    });
  });
});
