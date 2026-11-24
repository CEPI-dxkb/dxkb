import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Suspense } from "react";
import { vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

vi.mock("@/lib/services/organisms/summary", () => ({
  fetchOrganismSummary: vi.fn(),
}));
// React's `cache` is a passthrough in Vitest, so the tile and the header sharing
// one count request cannot be observed here; going through `getTaxonGenomeCount`
// is what shares it on the server.
vi.mock("@/components/organisms/shared/forget-failed-counts", () => ({
  forgetFailedCounts: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/lib/services/organisms/genome-count", () => ({
  getTaxonGenomeCount: vi.fn(),
}));

import { TaxonomySummary } from "../taxonomy-summary";
import { forgetFailedCounts } from "@/components/organisms/shared/forget-failed-counts";
import { UpstreamError } from "@/lib/api/upstream-failure";
import { getTaxonGenomeCount } from "@/lib/services/organisms/genome-count";
import { fetchOrganismSummary } from "@/lib/services/organisms/summary";
import { setTestSession } from "@/test-helpers/api-route-helpers";
import { createPendingNavigation } from "@/test-helpers/pending-navigation";

const brucellaTaxon = {
  taxonId: 234,
  taxonName: "Brucella",
  taxonRank: "genus",
  lineageNames: [],
  lineageIds: [],
  genomes: 1909,
};

// The PDB tile's `use` retries after its promise settles, so render in an async act.
async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  let rendered!: ReturnType<typeof render>;
  await act(async () => {
    rendered = render(resolved);
    await Promise.resolve();
  });
  return rendered;
}

/** The tile's retrying Unavailable count; throws when the tile shows something else. */
function unavailableIn(id: string) {
  return within(screen.getByTestId(`taxon-stat-${id}`)).getByRole("button", {
    name: /^Unavailable/,
  });
}

/** The failed tile's description (its tooltip and sr-only text): the original one, the reason, and how to retry. */
function expectFailedDescription(id: string, description: string, reason: string) {
  const tile = screen.getByTestId(`taxon-stat-${id}`);
  expect(
    within(tile).getByText(
      `${description}. Could not load: ${reason} Click Unavailable to retry.`,
    ),
  ).toHaveClass("sr-only");
  expect(tile.querySelector("[title]")).toBeNull();
}

/** A failed count shows no alert row, no lead text and no Retry button. */
function expectNoCountAlert() {
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText(/could not be loaded/)).toBeNull();
  expect(screen.queryByRole("button", { name: /Retry/ })).toBeNull();
}

beforeEach(() => {
  refresh.mockReset();
  vi.mocked(forgetFailedCounts).mockClear();
});

describe("TaxonomySummary", () => {
  it("renders all metrics when summary fetch succeeds and taxon prop is provided", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 1909,
      uniqueFamily: 1,
      uniqueGenus: 1,
      uniqueSpecies: 5,
      cds: 1_000_000,
      matPeptide: null,
      pdb: Promise.resolve({ status: "fulfilled", value: 50 }),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(screen.getByText("Brucella")).toBeInTheDocument();
    expect(screen.getByText("Genus")).toBeInTheDocument();
    expect(screen.getByText("1,909")).toBeInTheDocument();
    expect(screen.getByText("1,000,000")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("links each count tile to its tab and leaves the rest unlinked", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 1909,
      uniqueFamily: 1,
      uniqueGenus: 1,
      uniqueSpecies: 5,
      cds: 1_000_000,
      matPeptide: null,
      pdb: Promise.resolve({ status: "fulfilled", value: 50 }),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    const base = "/taxonomy/234";
    // By accessible name, so a tile whose link lost its label fails here.
    expect(
      screen.getByRole("link", { name: /^Genomes \/ Segments\b/ }),
    ).toHaveAttribute("href", `${base}?tab=genomes`);
    expect(
      screen.getByRole("link", { name: /^Protein Coding Genes \(CDS\)/ }),
    ).toHaveAttribute("href", `${base}?tab=features&feature_type=CDS`);
    expect(
      screen.getByRole("link", { name: /^3D Protein Structures \(PDB\)/ }),
    ).toHaveAttribute(
      "href",
      `${base}?tab=protein-structures&rql=ne(method,Predicted)`,
    );
    expect(screen.getAllByRole("link")).toHaveLength(3);
    for (const id of ["taxon-id", "taxon-name", "taxon-rank", "species"]) {
      expect(
        within(screen.getByTestId(`taxon-stat-${id}`)).queryByRole("link"),
      ).toBeNull();
    }
  });

  it("uses no native title tooltip on any tile", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 1909,
      uniqueFamily: 1,
      uniqueGenus: 1,
      uniqueSpecies: 5,
      cds: 1_000_000,
      matPeptide: null,
      pdb: Promise.resolve({ status: "fulfilled", value: 50 }),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    const { container } = await renderServer(
      TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }),
    );

    expect(container.querySelector("[title]")).toBeNull();
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
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(screen.getByText("Brucella")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Unavailable$/ })).toHaveLength(3);
    expect(screen.queryByText("-")).toBeNull();
    const genomes = screen.getByTestId("taxon-stat-genomes");
    expect(within(genomes).getByText("1,909")).toBeInTheDocument();
    expectNoCountAlert();
    const reason =
      "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: Site Maintenance — We’ll be back soon!).";
    for (const id of ["species", "cds", "pdb"]) {
      const button = unavailableIn(id);
      expect(button).toHaveAccessibleDescription(`Click to retry. ${reason}`);
      expect(button).not.toHaveAccessibleDescription(/summary_by_taxon/);
      // A failed tile is not a link: its button would nest inside one.
      expect(
        within(screen.getByTestId(`taxon-stat-${id}`)).queryByRole("link"),
      ).toBeNull();
    }
    expectFailedDescription("species", "Unique taxonomy species", reason);
    expectFailedDescription("cds", "Coding sequences", reason);
    expectFailedDescription(
      "pdb",
      "Experimentally determined structures (AlphaFold predictions excluded)",
      reason,
    );
    // The genome count loaded, so its tile keeps its link.
    expect(within(genomes).getByRole("link")).toHaveAttribute(
      "href",
      "/taxonomy/234?tab=genomes",
    );

    fireEvent.click(unavailableIn("cds"));
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    // The retry first forgets this taxon's cached failed counts.
    expect(forgetFailedCounts).toHaveBeenCalledWith([234]);
    expect(
      vi.mocked(forgetFailedCounts).mock.invocationCallOrder[0],
    ).toBeLessThan(refresh.mock.invocationCallOrder[0]);
  });

  it("disables and spins every failed count while a retry is pending", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(new Error("summary down"));
    vi.mocked(getTaxonGenomeCount).mockRejectedValueOnce(new Error("count down"));
    const navigation = createPendingNavigation();
    refresh.mockImplementation(() => {
      navigation.arm();
    });

    const summary = await TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          {summary}
          <navigation.Suspender />
        </Suspense>,
      );
      await Promise.resolve();
    });
    await act(() => {
      fireEvent.click(unavailableIn("species"));
      return Promise.resolve();
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    const buttons = screen.getAllByRole("button", { name: /^Unavailable$/ });
    expect(buttons).toHaveLength(4);
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    }
    expect(screen.queryByRole("status")).toBeNull();
    // A second click while retrying neither forgets nor refreshes again.
    await act(() => {
      fireEvent.click(unavailableIn("cds"));
      return Promise.resolve();
    });
    expect(forgetFailedCounts).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("says every count is unavailable when the summary and the genome count both fail", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(new Error("summary down"));
    vi.mocked(getTaxonGenomeCount).mockRejectedValueOnce(new Error("count down"));

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(screen.getAllByRole("button", { name: /^Unavailable$/ })).toHaveLength(4);
    // Each tile gives its own count's reason.
    expect(unavailableIn("genomes")).toHaveAccessibleDescription(
      "Click to retry. count down",
    );
    for (const id of ["species", "cds", "pdb"]) {
      expect(unavailableIn(id)).toHaveAccessibleDescription(
        "Click to retry. summary down",
      );
    }
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expectNoCountAlert();
  });

  it("shows the lineage-less-Deprecated count, not the summary's count or the taxon record's", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 9_571_230,
      uniqueFamily: 1,
      uniqueGenus: 6,
      uniqueSpecies: 1_449,
      cds: 1,
      matPeptide: null,
      pdb: Promise.resolve({ status: "fulfilled", value: 1 }),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(9_471_991);

    await renderServer(
      TaxonomySummary({
        taxonId: 11118,
        taxon: { ...brucellaTaxon, taxonId: 11118, genomes: 9_500_742 },
      }),
    );

    const genomes = screen.getByTestId("taxon-stat-genomes");
    expect(within(genomes).getByText("9,471,991")).toBeInTheDocument();
    expect(screen.queryByText("9,571,230")).toBeNull();
    expect(screen.queryByText("9,500,742")).toBeNull();
    expect(getTaxonGenomeCount).toHaveBeenCalledWith(11118, undefined);
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
      pdb: Promise.resolve({ status: "fulfilled", value: 0 }),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1906);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    expect(getTaxonGenomeCount).toHaveBeenCalledWith(234, "user-token");
  });

  it("marks only the genome tile unavailable, with the reason, when just the count fails", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 5,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 5,
      cds: 7,
      matPeptide: null,
      pdb: Promise.resolve({ status: "fulfilled", value: 9 }),
    });
    vi.mocked(getTaxonGenomeCount).mockRejectedValueOnce(
      new Error("count service did not respond"),
    );

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    const genomes = screen.getByTestId("taxon-stat-genomes");
    expect(unavailableIn("genomes")).toHaveAccessibleDescription(
      "Click to retry. count service did not respond",
    );
    expectFailedDescription(
      "genomes",
      "Assembled genome records",
      "count service did not respond.",
    );
    expect(within(genomes).queryByRole("link")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Unavailable$/ })).toHaveLength(1);
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /^Protein Coding Genes \(CDS\)/ }),
    ).toBeInTheDocument();
    expectNoCountAlert();
  });

  it("marks only the PDB tile unavailable, with the structure count's reason, when just that count fails", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 5,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 4,
      cds: 7,
      matPeptide: null,
      pdb: Promise.resolve({
        status: "rejected",
        reason: new UpstreamError({
          status: 504,
          code: "upstream_timeout",
          message:
            "PDB structures: The BV-BRC data service did not respond (timed out after 60 s).",
          source: "protein_structure count",
        }),
      }),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    const pdb = await within(screen.getByTestId("taxon-stat-pdb")).findByRole(
      "button",
      { name: /^Unavailable$/ },
    );
    expect(pdb).toHaveAccessibleDescription(
      "Click to retry. PDB structures: The BV-BRC data service did not respond (timed out after 60 s).",
    );
    expectFailedDescription(
      "pdb",
      "Experimentally determined structures (AlphaFold predictions excluded)",
      "PDB structures: The BV-BRC data service did not respond (timed out after 60 s).",
    );
    expect(screen.getAllByRole("button", { name: /^Unavailable$/ })).toHaveLength(1);
    expect(
      within(screen.getByTestId("taxon-stat-pdb")).queryByRole("link"),
    ).toBeNull();
    // The tiles that loaded keep their links.
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(
      within(screen.getByTestId("taxon-stat-species")).getByText("4"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("taxon-stat-cds")).getByText("7"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("taxon-stat-genomes")).getByText("1,909"),
    ).toBeInTheDocument();
    expectNoCountAlert();
  });

  it("renders every other tile while the PDB count is still pending, with no alert", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 5,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 4,
      cds: 7,
      matPeptide: null,
      pdb: new Promise(() => undefined),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: brucellaTaxon }));

    const pdb = screen.getByTestId("taxon-stat-pdb");
    expect(within(pdb).getByText("Loading")).toBeInTheDocument();
    expect(within(pdb).queryByText("Unavailable")).toBeNull();
    expect(
      within(screen.getByTestId("taxon-stat-cds")).getByText("7"),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("taxon-stat-genomes")).getByText("1,909"),
    ).toBeInTheDocument();
    expect(within(pdb).getByRole("link")).toBeInTheDocument();
    expectNoCountAlert();
  });

  it("renders summary metrics and '-' for taxon fields when taxon prop is null", async () => {
    vi.mocked(fetchOrganismSummary).mockResolvedValueOnce({
      count: 1909,
      uniqueFamily: null,
      uniqueGenus: null,
      uniqueSpecies: 5,
      cds: null,
      matPeptide: null,
      pdb: Promise.resolve({ status: "fulfilled", value: 0 }),
    });
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    await renderServer(TaxonomySummary({ taxonId: 234, taxon: null }));

    expect(screen.getByText("234")).toBeInTheDocument();
    expect(screen.getByText("1,909")).toBeInTheDocument();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });

  it("throws when summary fetch fails and taxon prop is null", async () => {
    vi.mocked(fetchOrganismSummary).mockRejectedValueOnce(new Error("summary boom"));
    vi.mocked(getTaxonGenomeCount).mockResolvedValueOnce(1909);

    await expect(TaxonomySummary({ taxonId: 234, taxon: null })).rejects.toThrow("summary boom");
  });
});
