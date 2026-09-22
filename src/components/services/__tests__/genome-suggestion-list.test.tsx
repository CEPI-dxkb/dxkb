import { fireEvent, render, screen } from "@testing-library/react";

import { GenomeSuggestionList } from "@/components/services/genome-suggestion-list";

const suggestions = [
  {
    genome_id: "83332.12",
    genome_name: "Escherichia coli",
    strain: "K-12",
    public: false,
  },
  {
    genome_id: "224308.43",
    genome_name: "Bacillus subtilis",
  },
];

describe("GenomeSuggestionList", () => {
  it("renders genome metadata and delegates enabled selection", () => {
    const onSelect = vi.fn();
    const onHighlight = vi.fn();

    render(
      <GenomeSuggestionList
        suggestions={suggestions}
        isLoading={false}
        error={null}
        emptyMessage={null}
        highlightedIndex={1}
        itemRefs={{ current: [] }}
        onSelect={onSelect}
        onHighlight={onHighlight}
        isDisabled={(genome) => genome.genome_id === "83332.12"}
        showPrivateIndicator
      />,
    );

    const duplicate = screen.getByRole("button", { name: /Escherichia coli/i });
    expect(duplicate).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(duplicate);
    expect(onSelect).not.toHaveBeenCalled();

    const available = screen.getByRole("button", {
      name: /Bacillus subtilis/i,
    });
    fireEvent.mouseEnter(available);
    fireEvent.click(available);
    expect(onHighlight).toHaveBeenCalledWith(1);
    expect(onSelect).toHaveBeenCalledWith(suggestions[1]);
    expect(screen.getByText(/83332\.12 • K-12/)).toBeVisible();
  });

  it("keeps the highlight background when itemClassName sets its own", () => {
    render(
      <GenomeSuggestionList
        suggestions={suggestions}
        isLoading={false}
        error={null}
        emptyMessage={null}
        highlightedIndex={1}
        itemRefs={{ current: [] }}
        onSelect={vi.fn()}
        onHighlight={vi.fn()}
        itemClassName="rounded-md border-0 bg-transparent text-sm"
      />,
    );

    // tailwind-merge resolves conflicting background utilities last-wins, so
    // the highlight class has to come after the caller's `bg-transparent`.
    const highlighted = screen.getByRole("button", {
      name: /Bacillus subtilis/i,
    });
    expect(highlighted).toHaveClass("bg-accent");
    expect(highlighted).not.toHaveClass("bg-transparent");

    // Non-conflicting caller classes must still survive the reorder.
    expect(highlighted).toHaveClass("rounded-md", "border-0", "text-sm");

    // Unhighlighted rows keep the caller's background.
    const other = screen.getByRole("button", { name: /Escherichia coli/i });
    expect(other).toHaveClass("bg-transparent");
    expect(other).not.toHaveClass("bg-accent");
  });
});
