import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("../taxonomy-collection", () => ({
  TaxonomyCollection: ({ initialState }: { initialState: unknown }) => (
    <div data-testid="state">{JSON.stringify(initialState)}</div>
  ),
}));

import TaxonomyCollectionPage from "../page";

describe("Taxonomy collection route", () => {
  it("parses canonical URL state in the server component", async () => {
    render(
      await TaxonomyCollectionPage({
        searchParams: Promise.resolve({
          keyword: "influenza",
          taxon_rank: ["species", "genus"],
          page: "2",
          sort: "taxon_name:asc",
        }),
      }),
    );
    expect(screen.getByTestId("state")).toHaveTextContent('"keyword":"influenza"');
    expect(screen.getByTestId("state")).toHaveTextContent(
      '"taxon_rank":["species","genus"]',
    );
    expect(screen.getByTestId("state")).toHaveTextContent('"page":2');
  });

  it("keeps the collection mounted across queries, so its open menus survive a pick", async () => {
    const collectionKey = async (params: Record<string, string>) => {
      const page = (await TaxonomyCollectionPage({
        searchParams: Promise.resolve(params),
      })) as ReactElement<{ children: ReactElement }>;
      return page.props.children.key;
    };
    expect(await collectionKey({ taxon_id: "10239" })).toBeNull();
    expect(await collectionKey({ taxon_id: "11520", page: "2" })).toBeNull();
  });
});
