import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { Suspense } from "react";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DataSummary } from "../data-summary";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";
const pathname = "/organisms/bacteria";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

/** Answers the experimental structure count the PDB tile uses, one number per lineage id. */
function answerStructures(counts: Record<number, number>) {
  server.use(
    http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
      const search = decodeURIComponent(new URL(request.url).search);
      const taxonId = Number(/eq\(taxon_lineage_ids,(\d+)\)/.exec(search)?.[1]);
      return HttpResponse.json({
        response: { numFound: counts[taxonId] ?? 0, docs: [] },
      });
    }),
  );
}

function summaryBody(count: number) {
  return {
    count,
    unique_family: 391,
    unique_genus: 5432,
    unique_species: 82915,
    CDS: 482001224,
    mat_peptide: 23144,
    PDB: 9821,
  };
}

/** Answers the genome count the Taxonomy header uses, one number per lineage id, and records each request. */
function serveGenomeCounts(counts: Record<string, number>) {
  const requests: { url: string; authorization: string | null }[] = [];
  server.use(
    http.get(`${baseUrl}/genome/`, ({ request }) => {
      requests.push({
        url: decodeURIComponent(request.url),
        authorization: request.headers.get("Authorization"),
      });
      const taxonId = /taxon_lineage_ids,(\d+)/.exec(
        decodeURIComponent(request.url),
      )?.[1];
      return HttpResponse.json({
        response: { numFound: counts[taxonId ?? ""] },
      });
    }),
  );
  return requests;
}

// The PDB tile's `use` retries after its promise settles, so render in an async act.
async function renderServer(node: Promise<React.ReactElement>) {
  const resolved = await node;
  let rendered!: ReturnType<typeof render>;
  await act(async () => {
    rendered = render(<Suspense fallback={null}>{resolved}</Suspense>);
    await Promise.resolve();
  });
  return rendered;
}

/** A failed count shows no alert row, no lead text and no Retry button. */
function expectNoCountAlert() {
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText(/could not be loaded/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Retry/ })).not.toBeInTheDocument();
}

beforeEach(() => {
  refresh.mockReset();
});

describe("DataSummary", () => {
  it("renders all KPI cards with formatted values", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
    );
    answerStructures({ 2: 68_899 });
    serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2], pathname }));

    expect(screen.getByText("Families")).toBeInTheDocument();
    expect(screen.getByText("482,001,224")).toBeInTheDocument();
    // The experimental count, not the payload's PDB (9,821).
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveTextContent("68,899");
    const pdb = screen.getByRole("link", { name: /^PDB Structures\b/ });
    expect(pdb).toHaveAttribute(
      "href",
      "/organisms/bacteria?tab=protein-structures&rql=ne(method,Predicted)",
    );
    expect(pdb).toHaveAccessibleDescription(
      "Experimentally determined structures (AlphaFold predictions excluded)",
    );
  });

  it("links Genomes, CDS, Mature Peptides and PDB Structures to their tab and leaves the taxonomy counts unlinked", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
    );
    answerStructures({ 2: 68_899 });
    serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2], pathname }));

    // By accessible name, so a tile whose link lost its label fails here.
    const hrefOf = (name: RegExp) =>
      screen.getByRole("link", { name }).getAttribute("href");
    expect(hrefOf(/^Genomes\b/)).toBe("/organisms/bacteria?tab=genomes");
    expect(hrefOf(/^CDS\b/)).toBe(
      "/organisms/bacteria?tab=features&feature_type=CDS",
    );
    expect(hrefOf(/^Mature Peptides\b/)).toBe(
      "/organisms/bacteria?tab=features&feature_type=mat_peptide",
    );
    expect(screen.getAllByRole("link")).toHaveLength(4);
    for (const key of ["uniqueFamily", "uniqueGenus", "uniqueSpecies"]) {
      expect(
        within(screen.getByTestId(`organism-kpi-${key}`)).queryByRole("link"),
      ).not.toBeInTheDocument();
    }
  });

  it("uses no native title tooltip on any tile", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
    );
    answerStructures({ 2: 68_899 });
    serveGenomeCounts({ 2: 1_300_000 });

    const { container } = await renderServer(
      DataSummary({ taxonIds: [2], pathname }),
    );

    expect(container.querySelector("[title]")).toBeNull();
  });

  it("shows the Taxonomy header's genome count in the Genomes tile, not the summary's", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
    );
    answerStructures({ 2: 68_899 });
    const requests = serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2], pathname }));

    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent(
      "1,300,000",
    );
    expect(screen.queryByText("1,337,420")).not.toBeInTheDocument();
    // A landing page is public, so the count is requested without a token, and
    // leaves Deprecated genomes out.
    expect(requests).toHaveLength(1);
    expect(requests[0].authorization).toBeNull();
    expect(requests[0].url).toContain(
      "and(eq(taxon_lineage_ids,2),ne(genome_status,Deprecated))",
    );
  });

  it("sums the Genomes tile across several roots from their live counts", async () => {
    const requested: string[] = [];
    answerStructures({ 131567: 79_938, 10239: 17_243 });
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/131567`, () => {
        requested.push("131567");
        return HttpResponse.json({
          ...summaryBody(1_427_115),
          unique_family: 1076,
        });
      }),
      http.get(`${baseUrl}/data/summary_by_taxon/10239`, () => {
        requested.push("10239");
        return HttpResponse.json({
          ...summaryBody(16_388_875),
          unique_family: 352,
        });
      }),
    );
    const requests = serveGenomeCounts({ 131567: 1_400_000, 10239: 14_900_000 });

    await renderServer(DataSummary({ taxonIds: [131567, 10239], pathname }));

    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent(
      "16,300,000",
    );
    expect(screen.queryByText("17,815,990")).not.toBeInTheDocument();
    expect(screen.getByTestId("organism-kpi-pdb")).toHaveTextContent("97,181");
    expect(requested.toSorted()).toEqual(["10239", "131567"]);
    expect(requests).toHaveLength(2);
  });

  it("marks only the PDB tile unavailable, with the original message behind a retrying Unavailable, when the structure count fails", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
      http.get(`${baseUrl}/protein_structure/`, () =>
        HttpResponse.text("BV-BRC overloaded", { status: 503 }),
      ),
    );
    serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2], pathname }));

    const pdbTile = screen.getByTestId("organism-kpi-pdb");
    const pdb = within(pdbTile).getByRole("button", { name: /^Unavailable$/ });
    expect(screen.getAllByRole("button", { name: /^Unavailable$/ })).toHaveLength(1);
    // A failed tile is not a link; the tiles that loaded keep theirs.
    expect(within(pdbTile).queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(3);
    const expected: Record<string, string> = {
      count: "1,300,000",
      uniqueFamily: "391",
      uniqueGenus: "5,432",
      uniqueSpecies: "82,915",
      cds: "482,001,224",
      matPeptide: "23,144",
    };
    for (const [key, value] of Object.entries(expected)) {
      expect(screen.getByTestId(`organism-kpi-${key}`)).toHaveTextContent(value);
    }
    const reason =
      "PDB structures: The BV-BRC data service is unavailable (HTTP 503 Service Unavailable: BV-BRC overloaded).";
    expect(pdb).toHaveAccessibleDescription(`Click to retry. ${reason}`);
    expect(pdb).not.toHaveAccessibleDescription(/protein_structure/);
    expect(pdbTile.querySelector("[title]")).toBeNull();
    expect(
      within(pdbTile).getByText(
        `Experimentally determined structures (AlphaFold predictions excluded). Could not load: ${reason} Click Unavailable to retry.`,
      ),
    ).toHaveClass("sr-only");
    expectNoCountAlert();

    fireEvent.click(pdb);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("loads the PDB count again when its Unavailable is clicked, instead of the cached failure", async () => {
    let structureRequests = 0;
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
      http.get(`${baseUrl}/protein_structure/`, () => {
        structureRequests += 1;
        return structureRequests === 1
          ? HttpResponse.text("BV-BRC overloaded", { status: 503 })
          : HttpResponse.json({ response: { numFound: 68_899, docs: [] } });
      }),
    );
    serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2], pathname }));
    // A render inside the retry window still gets the cached failure.
    cleanup();
    await renderServer(DataSummary({ taxonIds: [2], pathname }));
    expect(structureRequests).toBe(1);

    fireEvent.click(
      within(screen.getByTestId("organism-kpi-pdb")).getByRole("button", {
        name: /^Unavailable$/,
      }),
    );
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    // What the refresh renders: the forgotten failure is fetched again.
    cleanup();
    await renderServer(DataSummary({ taxonIds: [2], pathname }));
    await waitFor(() => {
      expect(screen.getByTestId("organism-kpi-pdb")).toHaveTextContent("68,899");
    });
    expect(structureRequests).toBe(2);
    expect(
      screen.getByRole("link", { name: /^PDB Structures\b/ }),
    ).toBeInTheDocument();
  });

  it("shows no alert and no Unavailable when every count loads", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
    );
    answerStructures({ 2: 68_899 });
    serveGenomeCounts({ 2: 1_300_000 });

    await renderServer(DataSummary({ taxonIds: [2], pathname }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Unavailable/ }),
    ).not.toBeInTheDocument();
  });

  it("marks PDB unavailable, not the other root's count, when only one root's structure count fails", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/131567`, () =>
        HttpResponse.json(summaryBody(1_427_115)),
      ),
      http.get(`${baseUrl}/data/summary_by_taxon/10239`, () =>
        HttpResponse.json(summaryBody(16_388_875)),
      ),
      http.get(`${baseUrl}/protein_structure/`, ({ request }) => {
        const search = decodeURIComponent(new URL(request.url).search);
        return search.includes("eq(taxon_lineage_ids,10239)")
          ? HttpResponse.text("BV-BRC overloaded", { status: 503 })
          : HttpResponse.json({ response: { numFound: 79_938, docs: [] } });
      }),
    );
    serveGenomeCounts({ 131567: 1_400_000, 10239: 14_900_000 });

    await renderServer(DataSummary({ taxonIds: [131567, 10239], pathname }));

    const pdb = screen.getByTestId("organism-kpi-pdb");
    expect(
      within(pdb).getByRole("button", { name: /^Unavailable$/ }),
    ).toHaveAccessibleDescription(/BV-BRC overloaded/);
    expect(pdb).not.toHaveTextContent("79,938");
    expect(screen.getByTestId("organism-kpi-count")).toHaveTextContent(
      "16,300,000",
    );
    expectNoCountAlert();
  });

  it("rejects when the genome count fails, like a failed summary", async () => {
    answerStructures({ 2: 68_899 });
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json(summaryBody(1337420)),
      ),
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({ error: "count down" }, { status: 500 }),
      ),
    );

    await expect(DataSummary({ taxonIds: [2], pathname })).rejects.toThrow(/count down/);
  });

  it("rejects when the summary fails", async () => {
    server.use(
      http.get(`${baseUrl}/data/summary_by_taxon/2`, () =>
        HttpResponse.json({ error: "summary down" }, { status: 500 }),
      ),
    );
    answerStructures({ 2: 68_899 });
    serveGenomeCounts({ 2: 1_300_000 });

    await expect(DataSummary({ taxonIds: [2], pathname })).rejects.toThrow();
  });
});
