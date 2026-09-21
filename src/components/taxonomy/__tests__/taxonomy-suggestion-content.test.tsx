import { fireEvent, render, screen } from "@testing-library/react";

import { TaxonomySuggestionContent } from "@/components/taxonomy/taxonomy-suggestion-content";

const result = {
  taxon_id: 562,
  taxon_name: "Escherichia coli",
  taxon_rank: "species",
  lineage_names: ["Bacteria", "Proteobacteria"],
};

describe("TaxonomySuggestionContent", () => {
  it("uses selector-specific renderers and delegates selection", () => {
    const onSelect = vi.fn();

    render(
      <TaxonomySuggestionContent
        results={[result]}
        loading={false}
        error={null}
        emptyMessage="No results"
        renderPrimary={(item) =>
          `${String(item.taxon_id)} [${item.taxon_name}]`
        }
        renderSecondary={(item) => item.lineage_names?.join(" > ")}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("562 [Escherichia coli]")).toBeVisible();
    expect(screen.getByText("Bacteria > Proteobacteria")).toBeVisible();
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith(result);
  });

  it("prioritizes errors over loading and empty states", () => {
    render(
      <TaxonomySuggestionContent
        results={[]}
        loading
        error="service unavailable"
        emptyMessage="No results"
        renderPrimary={(item) => item.taxon_name}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText("Error: service unavailable")).toBeVisible();
    expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
    expect(screen.queryByText("No results")).not.toBeInTheDocument();
  });
});
