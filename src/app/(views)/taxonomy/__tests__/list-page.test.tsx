import { render, screen } from "@testing-library/react";

vi.mock("../taxonomy-collection", async () => {
  const { useState } = await import("react");
  return {
    // The first props it mounted with live in state, so a remount shows.
    TaxonomyCollection: ({ initialState }: { initialState: unknown }) => {
      const [mountedWith] = useState(() => JSON.stringify(initialState));
      return (
        <div data-testid="state" data-mounted-with={mountedWith}>
          {JSON.stringify(initialState)}
        </div>
      );
    },
  };
});

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
    const { rerender } = render(
      await TaxonomyCollectionPage({
        searchParams: Promise.resolve({ taxon_id: "10239" }),
      }),
    );
    const collection = screen.getByTestId("state");

    rerender(
      await TaxonomyCollectionPage({
        searchParams: Promise.resolve({ taxon_id: "11520", page: "2" }),
      }),
    );

    expect(screen.getByTestId("state")).toBe(collection);
    expect(collection).toHaveTextContent('"taxon_id":["11520"]');
    expect(collection).toHaveTextContent('"page":2');
    expect(collection.dataset.mountedWith).toContain('"taxon_id":["10239"]');
  });
});
