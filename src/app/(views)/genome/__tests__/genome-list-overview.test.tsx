import { render } from "@testing-library/react";

const { sectionsSpy } = vi.hoisted(() => ({ sectionsSpy: vi.fn() }));

vi.mock("@/components/organisms/taxon-views/overview", () => ({
  GenomeOverviewSections: (props: Record<string, unknown>) => {
    sectionsSpy(props);
    return null;
  },
}));

import { GenomeListOverview } from "../genome-list-overview";

describe("GenomeListOverview", () => {
  it("remembers hidden charts under the genome view type", () => {
    const genomeQuery = { keywordRql: "keyword(pseudomonas)" };
    const state = { filters: {}, page: 1, sort: "unsorted" };

    render(<GenomeListOverview genomeQuery={genomeQuery} state={state} />);

    expect(sectionsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        viewType: "genome",
        scope: { genomeQuery },
        genomeList: { pathname: "/genome", state },
      }),
    );
  });
});
