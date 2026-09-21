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
});
