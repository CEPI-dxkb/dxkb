import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

vi.mock("@/lib/services/organisms/summary", () => ({
  fetchOrganismSummary: vi.fn(),
}));
vi.mock("@/lib/services/organisms/genome-count", () => ({
  fetchTaxonGenomeCount: vi.fn(),
}));

import { TaxonomySummary } from "../taxonomy-summary";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { fetchTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import { setTestSession } from "@/test-helpers/api-route-helpers";

const brucellaTaxon = {
  taxonId: 234,
  taxonName: "Brucella",
  taxonRank: "genus",
  lineageNames: [],
  lineageIds: [],
  genomes: 1909,
};

async function renderServer(node: Promise<React.ReactElement>) {
  return render(await node);
}

describe("TaxonomySummary", () => {
  it("renders all metrics when summary fetch succeeds and taxon prop is provided", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 1909,
      uniqueFamily: 1,
      uniqueGenus: 1,
      uniqueSpecies: 5,
      cds: 1_000_000,
      matPeptide: null,
      pdb: 50,
    });
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(screen.getByText("Brucella")).toBeInTheDocument();
    expect(screen.getByText("Genus")).toBeInTheDocument();
    expect(screen.getByText("1,909")).toBeInTheDocument();
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("says the summary counts are unavailable, and why, when the summary fetch fails", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(
      new UpstreamError({
        status: 503,
        code: "service_unavailable",
        message:
          "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance — We’ll be back soon!).",
        source: "summary_by_taxon",
      }),
    );
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(screen.getByText("Brucella")).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(screen.queryByText("-")).toBeNull();
    const genomes = screen.getByTitle("Assembled genome records");
    expect(within(genomes).getByText("1,909")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Taxon counts could not be loaded: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance — We’ll be back soon!).",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("summary_by_taxon");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("says every count is unavailable when the summary and the genome count both fail", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(new Error("summary down"));
    vi.mocked(fetchTaxonGenomeCount).mockRejectedValueOnce(new Error("count down"));

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
    const genomes = screen.getByTitle("Assembled genome records");
    expect(within(genomes).getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("summary down");
  });

  it("shows the lineage-less-Deprecated count, not the summary's count or the taxon record's", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 9_571_230,
      uniqueFamily: 1,
      uniqueGenus: 6,
      uniqueSpecies: 1_449,
      cds: 1,
      matPeptide: null,
      pdb: 1,
    });
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(9_471_991);

    await renderServer(
      TaxonomySummary({
        taxonId: 11118,
        taxon: { ...brucellaTaxon, taxonId: 11118, genomes: 9_500_742 },
      }),
    );

    const genomes = screen.getByTitle("Assembled genome records");
    expect(within(genomes).getByText("9,471,991")).toBeInTheDocument();
    expect(screen.queryByText("9,571,230")).toBeNull();
    expect(screen.queryByText("9,500,742")).toBeNull();
  });

  it("sends the signed-in user's token so the tile counts what the header counts", async () => {
    setTestSession({ token: "user-token", userId: "chrescobar" });
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 1,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 1,
      cds: null,
      matPeptide: null,
      pdb: null,
    });
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1906);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(fetchTaxonGenomeCount).toHaveBeenCalledWith(234, {
      token: "user-token",
    });
  });

  it("marks only the genome tile unavailable, with the reason, when just the count fails", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 5,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 5,
      cds: 7,
      matPeptide: null,
      pdb: 9,
    });
    vi.mocked(fetchTaxonGenomeCount).mockRejectedValueOnce(
      new Error("count service did not respond"),
    );

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    const genomes = screen.getByTitle("Assembled genome records");
    expect(within(genomes).getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "count service did not respond",
    );
  });

  it("renders summary metrics and '-' for taxon fields when taxon prop is null", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 1909,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 5,
      cds: null,
      matPeptide: null,
      pdb: null,
    });
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: null }));

    expect(screen.getByText("234")).toBeInTheDocument();
    expect(screen.getByText("1,909")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });

  it("throws when summary fetch fails and taxon prop is null", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(new Error("summary boom"));
    vi.mocked(fetchTaxonGenomeCount).mockResolvedValueOnce(1909);

    await expect(TaxonomySummary({ taxonId: 234, taxon: null })).rejects.toThrow("summary boom");
  });
});
