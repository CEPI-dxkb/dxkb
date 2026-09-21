import { render, screen } from "@testing-library/react";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({
  getEpitope: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  usePathname: () => "/epitope/15780",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/epitope-view/server", () => ({ getEpitope: mocks.getEpitope }));

interface ResourceChildCollectionProps {
  resource: string;
  rql: string;
}

vi.mock("@/components/views", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/views")>();
  return {
    ...original,
    ResourceChildCollection: ({
      resource,
      rql,
    }: ResourceChildCollectionProps) => (
      <div
        data-testid="resource-child"
        data-resource={resource}
        data-rql={rql}
      />
    ),
  };
});

import EpitopePage, { generateMetadata } from "../page";

const epitope = {
  epitope_id: "15780",
  epitope_type: "Discontinuous peptide",
  epitope_sequence: "A1, C4, D8",
  organism: "Influenza A virus",
  taxon_id: 11520,
  protein_name: "Hemagglutinin",
  total_assays: 2,
  assay_results: ["Positive", "Negative"],
  comments: "Residues are not assumed to be contiguous.",
};

describe("Epitope member route", () => {
  beforeEach(() => {
    mocks.getEpitope.mockReset();
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
    mocks.getEpitope.mockResolvedValue(epitope);
  });

  it("renders grouped overview, discontinuous sequence, and IEDB link", async () => {
    render(
      await EpitopePage({
        params: Promise.resolve({ epitopeId: "15780" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getAllByText("A1, C4, D8").length).toBeGreaterThan(0);
    expect(screen.getByText("Identity and sequence")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View in IEDB/ })).toHaveAttribute(
      "href",
      "https://www.iedb.org/epitope/15780",
    );
    await expect(
      generateMetadata({ params: Promise.resolve({ epitopeId: "15780" }) }),
    ).resolves.toMatchObject({ title: "A1, C4, D8 | Epitope" });
  });

  it("renders the exact assays collection", async () => {
    render(
      await EpitopePage({
        params: Promise.resolve({ epitopeId: "15780" }),
        searchParams: Promise.resolve({ tab: "assays" }),
      }),
    );
    expect(screen.getByTestId("resource-child")).toHaveAttribute(
      "data-resource",
      "epitope_assay",
    );
    expect(screen.getByTestId("resource-child")).toHaveAttribute(
      "data-rql",
      "eq(epitope_id,15780)",
    );
  });

  it("resolves one identifier from both entry points for a percent-bearing ID", async () => {
    // Same asymmetry as the Feature route: the page component receives
    // `encodeURIComponent(id)` and `generateMetadata` the decoded `id`, so
    // decoding in the shared loader regardless of caller made the two
    // disagree for any id carrying a literal percent escape.
    const percentId = "15780%2F1";
    mocks.getEpitope.mockResolvedValue(epitope);

    await EpitopePage({
      params: Promise.resolve({ epitopeId: encodeURIComponent(percentId) }),
      searchParams: Promise.resolve({}),
    });
    await generateMetadata({
      params: Promise.resolve({ epitopeId: percentId }),
    });

    const requestedIds = mocks.getEpitope.mock.calls.map(
      (call: unknown[]) => call[0],
    );
    expect(requestedIds).toEqual([percentId, percentId]);
  });

  it("canonicalizes invalid tabs while preserving unrelated parameters", async () => {
    await expect(
      EpitopePage({
        params: Promise.resolve({ epitopeId: "15780" }),
        searchParams: Promise.resolve({ tab: "missing", source: "search" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/epitope/15780?source=search");
  });

  it("uses notFound for absent and inaccessible records", async () => {
    mocks.getEpitope.mockResolvedValue(null);
    await expect(
      EpitopePage({
        params: Promise.resolve({ epitopeId: "missing" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getEpitope.mockRejectedValue(
      new DataApiError("Forbidden", 403, "forbidden"),
    );
    await expect(
      EpitopePage({
        params: Promise.resolve({ epitopeId: "15780" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("preserves upstream failures", async () => {
    mocks.getEpitope.mockRejectedValue(
      new Error("Epitope backend unavailable"),
    );
    await expect(
      EpitopePage({
        params: Promise.resolve({ epitopeId: "15780" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("Epitope backend unavailable");
  });
});
