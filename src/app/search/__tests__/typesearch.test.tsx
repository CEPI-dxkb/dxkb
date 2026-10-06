import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/ui-preferences/provider", () => ({
  useUiPreference: () => [false, vi.fn()],
}));
vi.mock("@/components/views/resource-workspace", () => ({
  ResourceWorkspace: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/genome/genome-detail-panel", () => ({
  GenomeDetailPanel: () => null,
}));
vi.mock("@/components/services/list-data", () => ({
  ListData: ({ q }: { q: string }) => <div data-testid="list" data-q={q} />,
}));

import { TypeSearch } from "../typesearch";

describe("TypeSearch", () => {
  it.each([
    // ListData drops a query's `#...` as a legacy hash, so `#` must reach it
    // percent-encoded (keyword("#2"): the Data API reads %23).
    ['plasmid "#2"', "and(keyword(plasmid),keyword(%22%232%22))"],
    // One clause per term, Solr's NOT as RQL, as the canonical lists send.
    ["kinase NOT hypothetical", "and(keyword(kinase),not(keyword(hypothetical)))"],
  ])("lists %j as the canonical lists read ?keyword=", (q, expected) => {
    render(<TypeSearch q={q} searchtype="genome_sequence" />);
    expect(screen.getByTestId("list")).toHaveAttribute("data-q", expected);
  });
});
