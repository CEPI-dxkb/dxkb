vi.mock("server-only", () => ({}));

import { delay, http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import type { CompareRegionQuery } from "../contract";

const serviceUrl = "http://compare-region.test/services/compare_regions";

/** A focus row as the service sends it (2026-10-23), trimmed: string coordinates, a numbered name. */
const rawFocusRow = {
  beg: -4931,
  end: 5069,
  mid: 69,
  genome_id: "1004954.3",
  org_name: "(0) Brucella suis bv. 1 str. S2",
  contig_length: 280014,
  pinned_peg: "fig|1004954.3.peg.1",
  pinned_peg_strand: "-",
  features: [
    {
      fid: "fig|1004954.3.peg.1",
      type: "peg",
      beg: "684",
      end: "67",
      size: 618,
      strand: "-",
      contig: "AFFC01000001",
      function: "SSU ribosomal protein S4p (S9e)",
      set_number: 1,
      blast_identity: 100,
      reference_point: 69,
      offset: "306",
      location: "AFFC01000001_684_67",
      attributes: [
        ["pgfam", "PGF_00049893"],
        ["plfam", "PLF_234_00002516"],
      ],
    },
    {
      fid: "fig|1004954.3.peg.1.BLAST",
      type: "blast",
      beg: 681,
      end: 69,
      function: "blast hit for pin",
      blast_identity: "100",
      reference_point: 69,
      attributes: [["BLAST identity", 100]],
    },
    {
      fid: "fig|1004954.3.pg.1",
      type: "pseudogene",
      beg: "1019",
      end: "1785",
      strand: "+",
      function: null,
      reference_point: 69,
      attributes: [],
    },
    { fid: "fig|1004954.3.site.1", type: "site_annotation", beg: 10, end: 20 },
    { fid: "", type: "peg", beg: "x", end: 1 },
  ],
};

/** What the service answers for a gene it does not know (2026-10-23). */
const unknownGeneRows = [
  {
    mid: 0,
    beg: -5000,
    end: 5000,
    org_name: "(0) ",
    contig_length: null,
    pinned_peg: null,
    pinned_peg_strand: null,
    genome_id: null,
    features: [
      {
        fid: ".BLAST",
        type: "blast",
        beg: 0,
        end: 0,
        blast_identity: null,
        reference_point: 0,
        function: "blast hit for pin",
        attributes: [["BLAST identity", null]],
      },
    ],
  },
];

const query: CompareRegionQuery = {
  peg: "fig|1004954.3.peg.1",
  size: 10000,
  genomes: 10,
  method: "pgfam",
  filter: "reference",
  group: null,
};

function rpcAnswer(rows: unknown) {
  return HttpResponse.json({ jsonrpc: "2.0", id: 1, result: [rows] });
}

/** What the route answers, as a 502, for an answer this module cannot read. */
const unreadableAnswer = {
  name: "UpstreamError",
  status: 502,
  code: "upstream_error",
  message:
    "The BV-BRC compare region service sent an answer DXKB could not read.",
};

/** The error `run` throws; fails the test when it throws nothing. */
function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("expected a throw");
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("COMPARE_REGION_SERVICE_URL", serviceUrl);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseCompareRegionQuery", () => {
  it("reads a focus gene and its settings", async () => {
    const { parseCompareRegionQuery } = await import("../server");
    expect(
      parseCompareRegionQuery(
        new URLSearchParams({ peg: "fig|1004954.3.peg.1", genomes: "20" }),
      ),
    ).toEqual({ ...query, genomes: 20 });
  });

  it("refuses anything but a BRC ID, and settings it does not offer", async () => {
    const { parseCompareRegionQuery } = await import("../server");
    expect(parseCompareRegionQuery(new URLSearchParams())).toBeNull();
    expect(
      parseCompareRegionQuery(new URLSearchParams({ peg: "PATRIC.1.2.CDS" })),
    ).toBeNull();
    expect(
      parseCompareRegionQuery(
        new URLSearchParams({ peg: "fig|1.1.peg.1", size: "3" }),
      ),
    ).toBeNull();
    expect(
      parseCompareRegionQuery(
        new URLSearchParams({ peg: `fig|${"1".repeat(300)}` }),
      ),
    ).toBeNull();
  });

  it("reads the group from the route's query", async () => {
    const { parseCompareRegionQuery } = await import("../server");
    const path = "/u@bvbrc/home/Genome Groups/G1";
    expect(
      parseCompareRegionQuery(new URLSearchParams({ peg: "fig|1.1.peg.2", filter: "genomeGroup", group: path })),
    ).toEqual(expect.objectContaining({ filter: "genomeGroup", group: path }));
    expect(parseCompareRegionQuery(new URLSearchParams({ peg: "fig|1.1.peg.2", filter: "genomeGroup" }))).toBeNull();
  });
});

describe("normalizeCompareRegionRows", () => {
  it("maps the service's row to the contract", async () => {
    const { normalizeCompareRegionRows } = await import("../server");
    expect(normalizeCompareRegionRows([rawFocusRow], "pgfam")).toEqual([
      {
        genomeId: "1004954.3",
        genomeName: "Brucella suis bv. 1 str. S2",
        start: -4931,
        end: 5069,
        contigLength: 280014,
        pinnedFid: "fig|1004954.3.peg.1",
        pinnedStrand: "-",
        center: 69,
        features: [
          {
            fid: "fig|1004954.3.peg.1",
            type: "peg",
            start: 684,
            end: 67,
            strand: "-",
            product: "SSU ribosomal protein S4p (S9e)",
            family: 1,
            familyId: "PGF_00049893",
            identity: 100,
          },
          {
            fid: "fig|1004954.3.peg.1.BLAST",
            type: "blast",
            start: 681,
            end: 69,
            strand: null,
            product: "blast hit for pin",
            family: null,
            familyId: null,
            identity: 100,
          },
          {
            fid: "fig|1004954.3.pg.1",
            type: "pseudogene",
            start: 1019,
            end: 1785,
            strand: "+",
            product: "",
            family: null,
            familyId: null,
            identity: null,
          },
        ],
      },
    ]);
  });

  it("names the family the chosen method colors by", async () => {
    const { normalizeCompareRegionRows } = await import("../server");
    const rows = normalizeCompareRegionRows([rawFocusRow], "plfam");
    expect(rows.at(0)?.features.at(0)?.familyId).toBe("PLF_234_00002516");
  });

  it("answers no rows for a gene the service does not know", async () => {
    const { normalizeCompareRegionRows } = await import("../server");
    expect(normalizeCompareRegionRows(unknownGeneRows, "pgfam")).toEqual([]);
  });

  it.each([
    ["no rows", []],
    ["a focus row with no pinned gene", [{ ...rawFocusRow, pinned_peg: null }]],
    ["a focus row with no genome", [{ ...rawFocusRow, genome_id: null }]],
  ])(
    "fails loudly, not as an unknown gene, on %s",
    async (_shape, rows) => {
      const { normalizeCompareRegionRows } = await import("../server");
      expect(
        thrownBy(() => normalizeCompareRegionRows(rows, "pgfam")),
      ).toMatchObject(unreadableAnswer);
    },
  );

  it.each([{ set_number: "1" }, { reference_point: "69" }, { strand: "." }])(
    "fails loudly, not as an unknown gene, when the focus gene cannot be read (%o)",
    async (unreadable) => {
      const { normalizeCompareRegionRows } = await import("../server");
      const focusRow = {
        ...rawFocusRow,
        features: rawFocusRow.features.map((feature) =>
          feature.fid === rawFocusRow.pinned_peg
            ? { ...feature, ...unreadable }
            : feature,
        ),
      };
      expect(
        thrownBy(() => normalizeCompareRegionRows([focusRow], "pgfam")),
      ).toMatchObject(unreadableAnswer);
    },
  );

  it("drops a row that lost its pinned gene", async () => {
    const { normalizeCompareRegionRows } = await import("../server");
    const orphan = { ...rawFocusRow, genome_id: "2.1", pinned_peg: "fig|2.1.peg.9" };
    expect(
      normalizeCompareRegionRows([rawFocusRow, orphan], "pgfam").map(
        (row) => row.genomeId,
      ),
    ).toEqual(["1004954.3"]);
  });

  it("fails loudly on an answer it cannot read", async () => {
    const { normalizeCompareRegionRows } = await import("../server");
    expect(
      thrownBy(() => normalizeCompareRegionRows({ rows: [] }, "pgfam")),
    ).toMatchObject(unreadableAnswer);
  });
});

describe("readCompareRegion", () => {
  it("calls compare_regions_for_peg2 with the caller's bare token", async () => {
    let seen: { body: unknown; authorization: string | null } | null = null;
    server.use(
      http.post(serviceUrl, async ({ request }) => {
        seen = {
          body: await request.json(),
          authorization: request.headers.get("Authorization"),
        };
        return rpcAnswer([rawFocusRow]);
      }),
    );
    const { readCompareRegion } = await import("../server");

    const rows = await readCompareRegion(query, "un=user@bvbrc|sig=abc");

    expect(rows.map((row) => row.genomeId)).toEqual(["1004954.3"]);
    expect(seen).toEqual({
      body: expect.objectContaining({
        jsonrpc: "2.0",
        method: "SEED.compare_regions_for_peg2",
        params: [
          "fig|1004954.3.peg.1",
          10000,
          10,
          "pgfam",
          "representative+reference",
          {},
        ],
      }) as unknown,
      authorization: "un=user@bvbrc|sig=abc",
    });
  });

  it.each([
    ["genomeGroup", "genome_group", { genome_group: "/u@bvbrc/home/Genome Groups/G1" }],
    ["featureGroup", "feature_group", { feature_group: "/u@bvbrc/home/Feature Groups/F1" }],
  ] as const)("sends a %s as SEED's %s with the path in options", async (filter, serviceFilter, options) => {
    let params: unknown = null;
    server.use(
      http.post(serviceUrl, async ({ request }) => {
        params = ((await request.json()) as { params: unknown }).params;
        return rpcAnswer([rawFocusRow]);
      }),
    );
    const { readCompareRegion } = await import("../server");
    const group = Object.values(options)[0];
    await readCompareRegion({ ...query, filter, group }, "token");
    expect(params).toEqual([query.peg, query.size, query.genomes, query.method, serviceFilter, options]);
  });

  it("sends one request at a time and refuses a fifth in line", async () => {
    let inFlight = 0;
    let most = 0;
    server.use(
      http.post(serviceUrl, async () => {
        inFlight += 1;
        most = Math.max(most, inFlight);
        await delay(20);
        inFlight -= 1;
        return rpcAnswer([rawFocusRow]);
      }),
    );
    const { readCompareRegion, CompareRegionBusyError } = await import("../server");

    const settled = await Promise.allSettled(
      Array.from({ length: 5 }, () => readCompareRegion(query, undefined)),
    );

    expect(most).toBe(1);
    expect(settled.map((result) => result.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "rejected",
    ]);
    const refused = settled.at(4);
    expect(refused?.status === "rejected" && refused.reason).toBeInstanceOf(
      CompareRegionBusyError,
    );
  });

  it("gives back each request's place in line when it finishes", async () => {
    server.use(http.post(serviceUrl, () => rpcAnswer([rawFocusRow])));
    const { readCompareRegion } = await import("../server");

    const answered: number[] = [];
    for (let call = 0; call < 5; call += 1) {
      answered.push((await readCompareRegion(query, undefined)).length);
    }

    expect(answered).toEqual([1, 1, 1, 1, 1]);
  });

  it("still serves the next request after the service refused one", async () => {
    let calls = 0;
    server.use(
      http.post(serviceUrl, () => {
        calls += 1;
        if (calls > 1) return rpcAnswer([rawFocusRow]);
        return HttpResponse.json(
          {
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32603, message: "peg not found in Solr" },
          },
          { status: 500 },
        );
      }),
    );
    const { readCompareRegion } = await import("../server");

    await expect(readCompareRegion(query, undefined)).rejects.toThrow(
      "peg not found in Solr",
    );
    const rows = await readCompareRegion(query, undefined);

    expect(rows.map((row) => row.genomeId)).toEqual(["1004954.3"]);
  });

  it("never sends a request whose caller left while it waited", async () => {
    const sent: string[] = [];
    server.use(
      http.post(serviceUrl, async ({ request }) => {
        const body = (await request.json()) as { params: [string] };
        sent.push(body.params[0]);
        await delay(20);
        return rpcAnswer([rawFocusRow]);
      }),
    );
    const { readCompareRegion } = await import("../server");
    const leaving = new AbortController();

    const first = readCompareRegion(query, undefined);
    const second = readCompareRegion({ ...query, peg: "fig|9.9.peg.9" }, undefined, leaving.signal);
    leaving.abort();

    await first;
    await expect(second).rejects.toMatchObject({ name: "AbortError" });
    expect(sent).toEqual(["fig|1004954.3.peg.1"]);
  });

  it("reads an answer with no rows as unreadable, not as an unknown gene", async () => {
    server.use(http.post(serviceUrl, () => rpcAnswer([])));
    const { readCompareRegion } = await import("../server");

    await expect(readCompareRegion(query, undefined)).rejects.toMatchObject(
      unreadableAnswer,
    );
  });

  it("reads an answer with no result as unreadable, not as a crash", async () => {
    server.use(
      http.post(serviceUrl, () =>
        HttpResponse.json({ jsonrpc: "2.0", id: 1, result: null }),
      ),
    );
    const { readCompareRegion } = await import("../server");

    await expect(readCompareRegion(query, undefined)).rejects.toMatchObject(
      unreadableAnswer,
    );
  });

  it("explains a missing service URL without naming it to the user", async () => {
    vi.stubEnv("COMPARE_REGION_SERVICE_URL", "");
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { readCompareRegion } = await import("../server");

    await expect(readCompareRegion(query, undefined)).rejects.toThrow(
      "The Compare Region Viewer is not configured on this server.",
    );
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("COMPARE_REGION_SERVICE_URL"),
    );
    logged.mockRestore();
  });
});
