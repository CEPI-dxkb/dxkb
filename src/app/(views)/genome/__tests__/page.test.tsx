import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../genome-collection", () => ({
  GenomeCollection: ({
    initialState,
    overview,
  }: {
    initialState: {
      page: number;
      sort: string;
      filters: Record<string, string[]>;
    };
    overview?: React.ReactNode;
  }) => (
    <div>
      <div data-testid="state">{JSON.stringify(initialState)}</div>
      {overview}
    </div>
  ),
}));
vi.mock("../genome-list-overview", () => ({
  GenomeListOverview: ({ genomeQuery }: { genomeQuery: unknown }) => (
    <div data-testid="overview">{JSON.stringify(genomeQuery)}</div>
  ),
}));
import GenomeCollectionPage from "../page";

describe("Genome collection route", () => {
  it("parses canonical URL state in the server component", async () => {
    render(
      await GenomeCollectionPage({
        searchParams: Promise.resolve({
          keyword: "coli",
          taxon_id: "561",
          page: "2",
          sort: "genome_length:desc",
        }),
      }),
    );
    expect(screen.getByTestId("state")).toHaveTextContent('"keyword":"coli"');
    expect(screen.getByTestId("state")).toHaveTextContent('"taxon_id":["561"]');
    expect(screen.getByTestId("state")).toHaveTextContent('"page":2');
  });

  it("renders the overview for the list's query only on the Overview tab", async () => {
    render(
      await GenomeCollectionPage({
        searchParams: Promise.resolve({
          keyword: "pseudomonas",
          tab: "overview",
        }),
      }),
    );
    expect(screen.getByTestId("overview")).toHaveTextContent(
      JSON.stringify({ keywordRql: "keyword(pseudomonas)" }),
    );
  });

  it("summarizes the bare list's recent genomes", async () => {
    render(
      await GenomeCollectionPage({
        searchParams: Promise.resolve({ tab: "overview" }),
      }),
    );
    expect(screen.getByTestId("overview")).toHaveTextContent(
      JSON.stringify({
        fieldRql:
          "and(gt(completion_date,NOW-1YEARS),ne(genome_status,Deprecated))",
      }),
    );
  });

  it.each([
    [{ keyword: "pseudomonas" }],
    [{ keyword: "pseudomonas", tab: "genomes" }],
    [{ public: "false", tab: "overview" }],
  ])("renders no overview for %o", async (params) => {
    render(
      await GenomeCollectionPage({ searchParams: Promise.resolve(params) }),
    );
    expect(screen.queryByTestId("overview")).not.toBeInTheDocument();
  });

  it("remounts for a new query but not for pagination or sorting", async () => {
    const collectionKey = async (params: Record<string, string>) => {
      const page = (await GenomeCollectionPage({
        searchParams: Promise.resolve(params),
      })) as ReactElement<{ children: ReactElement }>;
      return page.props.children.key;
    };

    const initialKey = await collectionKey({ taxon_id: "561" });

    expect(await collectionKey({ taxon_id: "561", page: "2" })).toBe(
      initialKey,
    );
    expect(
      await collectionKey({
        taxon_id: "561",
        sort: "genome_length:desc",
      }),
    ).toBe(initialKey);
    expect(await collectionKey({ taxon_id: "562" })).not.toBe(initialKey);
  });
});
