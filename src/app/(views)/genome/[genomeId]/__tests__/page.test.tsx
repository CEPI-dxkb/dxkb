import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({
  getGenome: vi.fn(),
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
    }: {
      resource: string;
      idField: string;
      label: string;
      rql: string;
      defaultFilters?: unknown;
    }) => (
      <div
        data-testid="resource-collection"
        data-resource={resource}
        data-id-field={idField}
        data-rql={rql}
        data-default-filters={
          defaultFilters ? JSON.stringify(defaultFilters) : undefined
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
