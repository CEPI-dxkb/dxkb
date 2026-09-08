import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataApiError } from "@/lib/data-api/repository";

const mocks = vi.hoisted(() => ({
  getGenome: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
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
    }: {
      resource: string;
      idField: string;
      label: string;
      rql: string;
    }) => (
      <div
        data-testid="resource-collection"
        data-resource={resource}
        data-id-field={idField}
        data-rql={rql}
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
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2CCDS))",
    );
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2CtRNA))",
    );
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2CrRNA))",
    );
    expect(screen.getByRole("link", { name: "4" })).toHaveAttribute(
      "href",
      "/feature?rql=and(eq(genome_id%2C83332.12)%2Ceq(feature_type%2Cmat_peptide))",
    );
    expect(
      await generateMetadata({
        params: Promise.resolve({ genomeId: "83332.12" }),
        searchParams: Promise.resolve({}),
      }),
    ).toMatchObject({ title: "E. coli | Genome" });
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
