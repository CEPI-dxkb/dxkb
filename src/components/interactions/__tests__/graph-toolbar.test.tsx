import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { GraphToolbar } from "../graph-toolbar";

const placeholder = "Search interaction results...";

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

  it("reflects the current filterValue back into the keyword input", () => {
    render(<GraphToolbar filterValue="groEL" onFilterChange={vi.fn()} />);

    expect(screen.getByPlaceholderText(placeholder)).toHaveValue("groEL");
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
