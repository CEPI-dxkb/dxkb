import { render, screen } from "@testing-library/react";

import {
  LazyBacterialPhylogenyPanel,
  LazyGenomeResourceCollection,
} from "../lazy-tab-roots";

// Imports that never resolve, so the wrappers stay on their loading fallback.
vi.mock("@/components/views/genome-resource-collection", () => new Promise<never>(() => undefined));
vi.mock("@/components/phylogeny/bacterial-phylogeny-panel", () => new Promise<never>(() => undefined));

describe("lazy tab root fallbacks", () => {
  it("fills a collection tab with a toolbar and table skeleton while it loads", () => {
    render(<LazyGenomeResourceCollection baseRql="eq(taxon_lineage_ids,1234)" />);

    const status = screen.getByRole("status", { name: "Loading tab" });
    expect(status).toHaveClass("flex", "min-h-0", "flex-1", "flex-col", "gap-2");
    const skeletons = status.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(2);
    expect(skeletons[0]).toHaveClass("h-10", "w-full");
    expect(skeletons[1]).toHaveClass("min-h-96", "w-full", "flex-1");
  });

  it("fills a phylogeny tab with one skeleton while it loads", () => {
    render(<LazyBacterialPhylogenyPanel taxonId={1280} taxonName="Staphylococcus aureus" />);

    const status = screen.getByRole("status", { name: "Loading tab" });
    expect(status).toHaveClass("flex", "min-h-0", "flex-1", "flex-col", "gap-2");
    const skeletons = status.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons).toHaveLength(1);
    expect(skeletons[0]).toHaveClass("size-full", "flex-1");
  });
});
