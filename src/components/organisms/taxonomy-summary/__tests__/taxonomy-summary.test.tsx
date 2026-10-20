import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

vi.mock("@/lib/services/organisms/summary", () => ({
  fetchOrganismSummary: vi.fn(),
}));

import { TaxonomySummary } from "../taxonomy-summary";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";

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

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(screen.getByText("Brucella")).toBeInTheDocument();
    // Species, CDS and PDB come only from the summary; none reads as "-".
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(screen.queryByText("-")).toBeNull();
    // The taxonomy record still knows the genome count the breadcrumb shows.
    const genomes = screen.getByTitle("Assembled genome records");
    expect(within(genomes).getByText("1,909")).toBeInTheDocument();
    // The line names the counts, so the message carries no label of its own,
    // and the endpoint is only for the log.
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Taxon counts could not be loaded: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance — We’ll be back soon!).",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("summary_by_taxon");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("says the genome count is unavailable when neither source has it", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(new Error("summary down"));

    await renderServer(
      TaxonomySummary({ taxonId: 234, taxon: { ...brucellaTaxon, genomes: null } }),
    );

    expect(screen.getAllByText("Unavailable")).toHaveLength(4);
  });

  it("falls back to the taxonomy record's genome count when the summary has none", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: null,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 5,
      cds: null,
      matPeptide: null,
      pdb: null,
    });

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    const genomes = screen.getByTitle("Assembled genome records");
    expect(within(genomes).getByText("1,909")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
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

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: null }));

    // Taxon ID falls back to the input taxonId
    expect(screen.getByText("234")).toBeInTheDocument();
    expect(screen.getByText("1,909")).toBeInTheDocument();
    // Two taxon-derived strings (taxonName, taxonRank) are "-"
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });

  it("throws when summary fetch fails and taxon prop is null", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(new Error("summary boom"));

    await expect(TaxonomySummary({ taxonId: 234, taxon: null })).rejects.toThrow("summary boom");
  });
});
