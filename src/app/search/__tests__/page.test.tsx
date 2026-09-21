import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/app/search/typesearch", () => ({
  TypeSearch: ({ q, searchtype }: { q: string; searchtype: string }) => (
    <div
      data-testid="type-search"
      data-query={q}
      data-search-type={searchtype}
    />
  ),
}));
vi.mock("@/app/all-term-search-results", () => ({
  SearchResults: ({ query }: { query: string }) => (
    <div data-testid="all-results" data-query={query} />
  ),
}));

import GlobalSearch from "../page";

describe("legacy search route", () => {
  beforeEach(() => {
    mocks.redirect.mockClear();
  });

  it("redirects Experiment searches to the canonical collection route", async () => {
    await expect(
      GlobalSearch({
        searchParams: Promise.resolve({
          type: "experiment",
          q: "RNA sequencing",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/experiment?keyword=RNA+sequencing");
  });

  it("normalizes the keyword while preserving other query values", async () => {
    await expect(
      GlobalSearch({
        searchParams: Promise.resolve({
          type: "experiment",
          q: " host/path + treatment ",
          source: "legacy search",
          filter: ["human", "mouse"],
        }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/experiment?keyword=host+path+++treatment&source=legacy+search&filter=human&filter=mouse",
    );
  });

  it.each(["experiment", "bioset"])(
    "quotes ID-like keywords before redirecting %s searches",
    async (type) => {
      await expect(
        GlobalSearch({
          searchParams: Promise.resolve({ type, q: "EC 1.1.1.1" }),
        }),
      ).rejects.toThrow(
        `NEXT_REDIRECT:/experiment?keyword=EC+%221.1.1.1%22${type === "bioset" ? "&tab=biosets" : ""}`,
      );
    },
  );

  it("maps the legacy Bioset search type to the canonical Biosets tab", async () => {
    await expect(
      GlobalSearch({
        searchParams: Promise.resolve({ type: "bioset", q: "RNA" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/experiment?keyword=RNA&tab=biosets");
  });

  it("maps a legacy Experiment Bioset tab marker to the canonical tab", async () => {
    await expect(
      GlobalSearch({
        searchParams: Promise.resolve({
          type: "experiment",
          q: "RNA",
          tab: "bioset",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/experiment?keyword=RNA&tab=biosets");
  });

  it("redirects legacy Taxa searches and preserves supported collection state", async () => {
    await expect(
      GlobalSearch({
        searchParams: Promise.resolve({
          type: "taxonomy",
          q: "Influenza A",
          taxon_id: ["10239", "11308"],
          sort: "taxon_name:asc",
          ignored: "value",
        }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/taxonomy?keyword=Influenza+A&taxon_id=10239&taxon_id=11308&sort=taxon_name%3Aasc",
    );
  });

  it("preserves every canonical Taxa filter through the redirect", async () => {
    await expect(
      GlobalSearch({
        searchParams: Promise.resolve({
          type: "taxonomy",
          q: "influenza",
          taxon_rank: ["species", "genus"],
          genetic_code: "1",
          division: "Viruses",
          refine: "H5N1",
          page: "2",
          ignored: "value",
        }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/taxonomy?keyword=influenza&taxon_rank=species&taxon_rank=genus&genetic_code=1&division=Viruses&refine=H5N1&page=2",
    );
  });

  it("redirects a canonical type that used to render the legacy list", async () => {
    await expect(
      GlobalSearch({
        searchParams: Promise.resolve({ type: "genome", q: "Escherichia" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/genome?keyword=Escherichia");
  });

  it.each(["genome_sequence", "genome_amr"])(
    "still renders the legacy type search for %s",
    async (type) => {
      render(
        await GlobalSearch({
          searchParams: Promise.resolve({ type, q: "Escherichia" }),
        }),
      );
      expect(screen.getByTestId("type-search")).toHaveAttribute(
        "data-search-type",
        type,
      );
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );

  it("prompts for a search term when Overview has no query", async () => {
    render(await GlobalSearch({ searchParams: Promise.resolve({}) }));
    expect(screen.getByText(/enter a search term/i)).toBeInTheDocument();
  });

  it.each([
    ["unsupported", { type: "pathway", q: "---" }],
    ["everything", { type: "everything", q: " / + " }],
    ["legacy list", { type: "genome_sequence", q: "---" }],
    ["canonical", { type: "genome", q: "---" }],
  ])("prompts for normalized-empty %s searches", async (_label, params) => {
    render(await GlobalSearch({ searchParams: Promise.resolve(params) }));

    expect(screen.getByText(/enter a search term/i)).toBeInTheDocument();
    expect(screen.queryByTestId("all-results")).not.toBeInTheDocument();
    expect(screen.queryByTestId("type-search")).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("offers the all-types results for a type with no view", async () => {
    render(
      await GlobalSearch({
        searchParams: Promise.resolve({ type: "pathway", q: "Escherichia" }),
      }),
    );
    expect(screen.getByText(/no search view for/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /search all data types/i }),
    ).toHaveAttribute("href", "/search?type=everything&q=Escherichia");
  });

  it("resolves Overview with a query to the all-types results", async () => {
    render(
      await GlobalSearch({
        searchParams: Promise.resolve({ q: "Escherichia" }),
      }),
    );
    expect(screen.getByTestId("all-results")).toHaveAttribute(
      "data-query",
      "Escherichia",
    );
  });

  it("continues rendering everything searches", async () => {
    render(
      await GlobalSearch({
        searchParams: Promise.resolve({ type: "everything", q: "Escherichia" }),
      }),
    );
    expect(screen.getByTestId("all-results")).toHaveAttribute(
      "data-query",
      "Escherichia",
    );
  });
});
