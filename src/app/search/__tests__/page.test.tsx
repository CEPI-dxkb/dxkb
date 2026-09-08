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

  it("continues rendering ordinary legacy type searches", async () => {
    render(
      await GlobalSearch({
        searchParams: Promise.resolve({ type: "taxonomy", q: "Escherichia" }),
      }),
    );
    expect(screen.getByTestId("type-search")).toHaveAttribute(
      "data-search-type",
      "taxonomy",
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
