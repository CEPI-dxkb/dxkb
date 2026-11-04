import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({
  getGenome: vi.fn(),
  getTaxonomy: vi.fn(),
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
  usePathname: () => "/genome/83332.12",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/genome-view/server", () => ({ getGenome: mocks.getGenome }));
vi.mock("@/lib/taxonomy-view/server", () => ({
  getTaxonomy: mocks.getTaxonomy,
}));
vi.mock("@/components/views", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/views")>();
  return {
    ...original,
    ExperimentResourceCollection: ({ baseRql }: { baseRql: string }) => (
      <div data-testid="experiment-collection" data-rql={baseRql} />
    ),
    ResourceChildCollection: ({
      resource,
      idField,
      label,
      rql,
      defaultFilters,
      defaultSort,
      unsortedOrder,
    }: {
      resource: string;
      idField: string;
      label: string;
      rql: string;
      defaultFilters?: unknown;
      defaultSort: string;
      unsortedOrder?: unknown;
    }) => (
      <div
        data-testid="resource-collection"
        data-resource={resource}
        data-id-field={idField}
        data-rql={rql}
        data-default-filters={
          defaultFilters ? JSON.stringify(defaultFilters) : undefined
        }
        data-default-sort={defaultSort}
        data-unsorted-order={
          unsortedOrder ? JSON.stringify(unsortedOrder) : undefined
        }
        data-show-header="false"
      >
        {label}
      </div>
    ),
  };
});

import GenomePage, { generateMetadata } from "../page";

describe("Genome member route", () => {
  beforeEach(() => {
    mocks.getGenome.mockReset();
    mocks.notFound.mockClear();
    mocks.redirect.mockClear();
    mocks.getTaxonomy.mockReset();
    mocks.getTaxonomy.mockResolvedValue(null);
    mocks.getGenome.mockResolvedValue({
      genome_id: "83332.12",
      genome_name: "E. coli",
      superkingdom: "Bacteria",
      genome_length: 5000,
      contigs: 2,
      cds: 10,
      trna: 2,
      rrna: 3,
      mat_peptide: 4,
    });
  });

  it("renders the overview and metadata", async () => {
    render(
      await GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole("heading", { name: "E. coli" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Assembly summary")).toBeInTheDocument();
    expect(screen.getByText("Length:")).toBeInTheDocument();
    expect(screen.getByText("Contigs:")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "10" })).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(genome_id,83332.12),eq(feature_type,CDS))",
    );
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(genome_id,83332.12),eq(feature_type,tRNA))",
    );
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(genome_id,83332.12),eq(feature_type,rRNA))",
    );
    expect(screen.getByRole("link", { name: "4" })).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(genome_id,83332.12),eq(feature_type,mat_peptide))",
    );
    expect(
      await generateMetadata({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({}),
      }),
    ).toMatchObject({ title: "E. coli | Genome" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("leads with BV-BRC's breadcrumb: the ranked lineage, then the genome", async () => {
    mocks.getGenome.mockResolvedValue({
      genome_id: "1595915.3",
      genome_name: "Campylobacter sp. 2014D-0259",
      taxon_id: 1595915,
      taxon_lineage_ids: [131567, 2, 3379134, 29547, 3031852, 213849, 72294, 194, 2648497, 1595915],
      taxon_lineage_names: ["cellular organisms", "Bacteria"],
    });
    mocks.getTaxonomy.mockResolvedValue({
      taxon_id: "1595915",
      lineage_ids: [131567, 2, 3379134, 29547, 3031852, 213849, 72294, 194, 2648497, 1595915],
      lineage_names: [
        "cellular organisms",
        "Bacteria",
        "Pseudomonadati",
        "Campylobacterota",
        "Epsilonproteobacteria",
        "Campylobacterales",
        "Campylobacteraceae",
        "Campylobacter",
        "unclassified Campylobacter",
        "Campylobacter sp. 2014D-0259",
      ],
      // BV-BRC's taxonomy as of 2026: NCBI ranks Bacteria a "domain", which
      // legacy's `visibleRanks` predates, so BV-BRC's breadcrumb starts at the phylum.
      lineage_ranks: [
        "cellular root",
        "domain",
        "kingdom",
        "phylum",
        "class",
        "order",
        "family",
        "genus",
        "no rank",
        "species",
      ],
    });
    const page = await GenomePage({
      params: Promise.resolve({ genomeId: "1595915.3" }),
      searchParams: Promise.resolve({}),
    });
    // The lineage streams in behind a Suspense boundary; let it land.
    await act(async () => {
      render(page);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mocks.getTaxonomy).toHaveBeenCalledWith("1595915");
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Campylobacter sp. 2014D-0259",
    });
    expect(
      [...(heading.parentElement?.querySelectorAll("a") ?? [])].map((link) => [
        link.textContent,
        link.getAttribute("href"),
      ]),
    ).toEqual([
      ["Campylobacterota", "/taxonomy/29547"],
      ["Epsilonproteobacteria", "/taxonomy/3031852"],
      ["Campylobacterales", "/taxonomy/213849"],
      ["Campylobacteraceae", "/taxonomy/72294"],
      ["Campylobacter", "/taxonomy/194"],
      ["Campylobacter sp. 2014D-0259", "/taxonomy/1595915"],
    ]);
  });

  it("repeats a crumb for a repeated rank, as BV-BRC's indexOf does", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.getGenome.mockResolvedValue({
      genome_id: "4.1",
      genome_name: "Leaf genome",
      taxon_id: 4,
    });
    mocks.getTaxonomy.mockResolvedValue({
      taxon_id: "4",
      lineage_ids: [1, 2, 3, 4],
      lineage_names: ["Phylum A", "Class A", "Class B", "Leaf"],
      lineage_ranks: ["phylum", "class", "class", "no rank"],
    });
    const page = await GenomePage({
      params: Promise.resolve({ genomeId: "4.1" }),
      searchParams: Promise.resolve({}),
    });
    await act(async () => {
      render(page);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const heading = screen.getByRole("heading", { level: 1, name: "Leaf genome" });
    expect(
      [...(heading.parentElement?.querySelectorAll("a") ?? [])].map((link) => link.textContent),
    ).toEqual(["Phylum A", "Class A", "Class A"]);
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain("same key");
    consoleError.mockRestore();
  });

  it("keeps the genome's name when the taxonomy lookup fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    mocks.getGenome.mockResolvedValue({
      genome_id: "83332.12",
      genome_name: "E. coli",
      taxon_id: 83332,
    });
    mocks.getTaxonomy.mockRejectedValue(new Error("Taxonomy unavailable"));
    const page = await GenomePage({
      params: Promise.resolve({ genomeId: "83332.12" }),
      searchParams: Promise.resolve({}),
    });
    await act(async () => {
      render(page);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const heading = screen.getByRole("heading", { level: 1, name: "E. coli" });
    expect(heading.parentElement?.querySelectorAll("a")).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledWith(
      "genome/83332.12: taxonomy/83332 lookup failed",
      expect.objectContaining({ message: "Taxonomy unavailable" }),
    );
    consoleError.mockRestore();
  });

  it("shows the genome without waiting for its lineage", async () => {
    // A stalled taxonomy lookup runs to the Data API's budget; the record has
    // loaded by then, so only the breadcrumb's taxa wait for it.
    mocks.getGenome.mockResolvedValue({
      genome_id: "83332.12",
      genome_name: "E. coli",
      taxon_id: 83332,
    });
    mocks.getTaxonomy.mockReturnValue(new Promise(() => undefined));
    render(
      await GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "E. coli" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Assembly summary")).toBeInTheDocument();
  });

  it("renders exact-scope child tabs", async () => {
    render(
      await GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({ tab: "sequences" }),
      }),
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-show-header",
      "false",
    );
    expect(screen.queryByText("Length:")).not.toBeInTheDocument();
    expect(screen.queryByText("Contigs:")).not.toBeInTheDocument();
    expect(screen.queryByText("Status:")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Browse sequences records."),
    ).not.toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    [{ tab: "missing", source: "search" }, "?source=search"],
    [{ tab: "overview" }, ""],
  ])("redirects a non-canonical tab query on the server", async (query, suffix) => {
    await expect(
      GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve(query),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:/genome/83332.12${suffix}`);
  });

  it("gives the Features tab legacy's removable PATRIC default", async () => {
    // Legacy's Genome Features tab lists PATRIC features until its default is
    // removed: 5,425 of genome 83332.12's 10,940.
    render(
      await GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({ tab: "features" }),
      }),
    );
    const features = screen.getByTestId("resource-collection");
    expect(features).toHaveAttribute("data-rql", "eq(genome_id,83332.12)");
    expect(features).toHaveAttribute(
      "data-default-filters",
      JSON.stringify({ annotation: ["PATRIC"] }),
    );
  });

  it.each(["features", "proteins"])(
    "orders the %s tab as legacy's grid does, with no column sorted",
    async (tab) => {
      // Legacy FeatureGrid and ProteinGrid: sort(+genome_name,+accession,+start),
      // so a genome's features run along each sequence from position 1.
      render(
        await GenomePage({
          params: Promise.resolve({ genomeId: "83332.12" }),
          searchParams: Promise.resolve({ tab }),
        }),
      );
      const collection = screen.getByTestId("resource-collection");
      expect(collection).toHaveAttribute("data-default-sort", "unsorted");
      expect(collection).toHaveAttribute(
        "data-unsorted-order",
        JSON.stringify({
          field: "genome_name",
          direction: "asc",
          then: [
            { field: "accession", direction: "asc" },
            { field: "start", direction: "asc" },
          ],
        }),
      );
    },
  );

  it("leaves the Proteins tab without a default, as its RQL pins PATRIC", async () => {
    render(
      await GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({ tab: "proteins" }),
      }),
    );
    expect(screen.getByTestId("resource-collection")).not.toHaveAttribute(
      "data-default-filters",
    );
  });

  it("renders exact-genome domains and motifs", async () => {
    render(
      await GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({ tab: "domains" }),
      }),
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-resource",
      "protein_feature",
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-id-field",
      "id",
    );
    expect(screen.getByTestId("resource-collection")).toHaveAttribute(
      "data-rql",
      "eq(genome_id,83332.12)",
    );
  });

  it("renders experiments with the exact Genome scope", async () => {
    render(
      await GenomePage({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({ tab: "experiments" }),
      }),
    );
    expect(screen.getByTestId("experiment-collection")).toHaveAttribute(
      "data-rql",
      "eq(genome_id,83332.12)",
    );
  });

  it("uses notFound for malformed and missing IDs", async () => {
    await expect(
      GenomePage({
        params: Promise.resolve({ genomeId: "bad" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    mocks.getGenome.mockResolvedValue(null);
    await expect(
      GenomePage({
        params: Promise.resolve({ genomeId: "1.1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it.each([401, 403])(
    "uses notFound for inaccessible status %s",
    async (status) => {
      mocks.getGenome.mockRejectedValue(
        new DataApiError("Inaccessible", status, "inaccessible"),
      );
      await expect(
        GenomePage({
          params: Promise.resolve({ genomeId: "1.1" }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.notFound).toHaveBeenCalled();
    },
  );

  it("preserves upstream errors", async () => {
    mocks.getGenome.mockRejectedValue(new Error("Backend unavailable"));
    await expect(
      GenomePage({
        params: Promise.resolve({ genomeId: "1.1" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("Backend unavailable");
  });
});
