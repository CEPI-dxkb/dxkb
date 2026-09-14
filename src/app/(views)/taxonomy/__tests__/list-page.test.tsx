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

  it("remounts for query changes but not pagination or sorting", async () => {
    const collectionKey = async (params: Record<string, string>) => {
      const page = (await TaxonomyCollectionPage({
        searchParams: Promise.resolve(params),
      })) as ReactElement<{ children: ReactElement }>;
      return page.props.children.key;
    };
    const initialKey = await collectionKey({ taxon_id: "10239" });
    expect(await collectionKey({ taxon_id: "10239", page: "2" })).toBe(initialKey);
    expect(
      await collectionKey({ taxon_id: "10239", sort: "taxon_name:asc" }),
    ).toBe(initialKey);
    expect(await collectionKey({ taxon_id: "11520" })).not.toBe(initialKey);
  });
});
