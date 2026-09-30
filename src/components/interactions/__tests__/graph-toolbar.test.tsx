import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";

import { keywordDebounceMs } from "@/components/filterbar/keyword-search";
import { GraphToolbar } from "../graph-toolbar";

const placeholder = "Search interaction results...";

// Holds the shared keyword the way InteractionsSubviewShell does, so a commit
// comes straight back as `filterValue`.
function SharedKeyword({
  initial = "",
  onFilterChange,
}: {
  initial?: string;
  onFilterChange: (value: string) => void;
}) {
  const [keyword, setKeyword] = useState(initial);
  return (
    <GraphToolbar
      filterValue={keyword}
      onFilterChange={(value) => {
        onFilterChange(value);
        setKeyword(value);
      }}
    />
  );
}

describe("GraphToolbar", () => {
  it("holds a draft and commits the keyword once for a whole typing burst", async () => {
    const onFilterChange = vi.fn();

    render(<GraphToolbar filterValue="" onFilterChange={onFilterChange} />);
    const keywordInput = screen.getByPlaceholderText(placeholder);

    // One input event per character, which is all KeywordSearch reports.
    for (const value of ["g", "gr", "gro", "groE", "groEL"]) {
      fireEvent.change(keywordInput, { target: { value } });
    }

    // This keyword is a request predicate for the Graph and for the Table that
    // shares it, so committing per keystroke meant two gateway requests per
    // character. Nothing is committed while the user is still typing.
    expect(onFilterChange).not.toHaveBeenCalled();
    expect(keywordInput).toHaveValue("groEL");

    await waitFor(() => { expect(onFilterChange).toHaveBeenCalledTimes(1); });
    expect(onFilterChange).toHaveBeenCalledWith("groEL");
  });

  it("commits trimmed text, as the table's keyword box does", async () => {
    const onFilterChange = vi.fn();

    render(<GraphToolbar filterValue="" onFilterChange={onFilterChange} />);
    fireEvent.change(screen.getByPlaceholderText(placeholder), {
      target: { value: "  groEL " },
    });

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalledWith("groEL");
    });
  });

  it("flushes one uncommitted draft when unmounted before the debounce", () => {
    const onFilterChange = vi.fn();
    const { unmount } = render(
      <GraphToolbar filterValue="" onFilterChange={onFilterChange} />,
    );

    fireEvent.change(screen.getByPlaceholderText(placeholder), {
      target: { value: "half-typed" },
    });
    unmount();

    expect(onFilterChange).toHaveBeenCalledExactlyOnceWith("half-typed");
  });

  it("reflects the current filterValue back into the keyword input", () => {
    render(<GraphToolbar filterValue="groEL" onFilterChange={vi.fn()} />);

    expect(screen.getByPlaceholderText(placeholder)).toHaveValue("groEL");
  });

  describe("with the shared keyword held above it", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("keeps a trailing space once its own trimmed keyword lands", () => {
      const onFilterChange = vi.fn();
      render(<SharedKeyword onFilterChange={onFilterChange} />);
      const keywordInput = screen.getByPlaceholderText(placeholder);

      fireEvent.change(keywordInput, { target: { value: "eco " } });
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs);
      });
      expect(onFilterChange).toHaveBeenCalledExactlyOnceWith("eco");
      expect(keywordInput).toHaveValue("eco ");

      // The next word follows the space instead of running into "eco".
      fireEvent.change(keywordInput, { target: { value: "eco k" } });
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs);
      });
      expect(onFilterChange).toHaveBeenLastCalledWith("eco k");
      expect(keywordInput).toHaveValue("eco k");
    });

    it("flushes typing that followed its own commit when the keyword lands late", () => {
      const onFilterChange = vi.fn();
      const { rerender, unmount } = render(
        <GraphToolbar filterValue="" onFilterChange={onFilterChange} />,
      );
      const keywordInput = screen.getByPlaceholderText(placeholder);

      fireEvent.change(keywordInput, { target: { value: "eco " } });
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs);
      });
      expect(onFilterChange).toHaveBeenCalledExactlyOnceWith("eco");

      // The user types on before "eco" comes back as the shared keyword.
      fireEvent.change(keywordInput, { target: { value: "eco k" } });
      rerender(<GraphToolbar filterValue="eco" onFilterChange={onFilterChange} />);
      expect(keywordInput).toHaveValue("eco k");

      // Leaving the Graph before the next debounce still commits that typing.
      unmount();
      expect(onFilterChange).toHaveBeenCalledTimes(2);
      expect(onFilterChange).toHaveBeenLastCalledWith("eco k");
    });

    it("does not commit a draft that differs from the keyword only by whitespace", () => {
      const onFilterChange = vi.fn();
      render(<SharedKeyword initial="eco" onFilterChange={onFilterChange} />);

      fireEvent.change(screen.getByPlaceholderText(placeholder), {
        target: { value: "eco " },
      });
      act(() => {
        vi.advanceTimersByTime(keywordDebounceMs * 3);
      });
      expect(onFilterChange).not.toHaveBeenCalled();
    });
  });

  it("adopts a keyword the sibling view committed, dropping an uncommitted draft", () => {
    const { rerender } = render(
      <GraphToolbar filterValue="" onFilterChange={vi.fn()} />,
    );
    fireEvent.change(screen.getByPlaceholderText(placeholder), {
      target: { value: "half-typ" },
    });

    rerender(<GraphToolbar filterValue="fromTable" onFilterChange={vi.fn()} />);

    expect(screen.getByPlaceholderText(placeholder)).toHaveValue("fromTable");
  });
});
