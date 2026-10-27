import { http, HttpResponse, type JsonBodyType } from "msw";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { server } from "@/test-helpers/msw-server";
import { ServerDataRepository } from "../repository";

const emptyPage = { response: { numFound: 0, docs: [] } };

/**
 * Answer every upstream GET for `resource` with `body` as JSON (an empty Solr
 * page by default), recording each request so a test can read it off the
 * wire.
 */
function captureGets(
  resource: string,
  body: JsonBodyType = emptyPage,
  init?: ResponseInit,
): Request[] {
  const requested: Request[] = [];
  server.use(
    http.get(`https://data.test/${resource}/`, ({ request }) => {
      requested.push(request);
      return HttpResponse.json(body, init);
    }),
  );
  return requested;
}

describe("ServerDataRepository", () => {
  it("combines rows, count, and facets with exclusive-end range and stable sorting", async () => {
    const requested = captureGets("genome", {
      response: {
        numFound: 251,
        docs: [{ genome_id: "1.1", genome_name: "One" }],
      },
      facet_counts: { facet_fields: { genus: ["Escherichia", 20] } },
    });

    const result = await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).collection("genome", {
      operation: "collection",
      page: 1,
      pageSize: 200,
      rql: "eq(genome_id,1.1)",
      fields: ["genome_id", "genome_name"],
      facets: ["genus"],
      sort: { field: "genome_name", direction: "asc" },
    });

    expect(requested).toHaveLength(1);
    expect(requested[0].url).toContain("eq(genome_id,1.1)");
    expect(requested[0].url).toContain("sort(+genome_name,+genome_id)");
    expect(requested[0].headers.get("Range")).toBe("items=0-200");
    expect(result).toEqual({
      rows: [{ genome_id: "1.1", genome_name: "One" }],
      total: 251,
      facets: { genus: [{ value: "Escherichia", count: 20 }] },
      page: 1,
      pageSize: 200,
    });
  });

  it("counts several facets in parallel, one upstream read each, and merges them", async () => {
    const requested: Request[] = [];
    server.use(
      http.get("https://data.test/genome/", ({ request }) => {
        requested.push(request);
        const field = /facet\((\w+),/.exec(decodeURIComponent(request.url))?.[1];
        return HttpResponse.json({
          response: {
            numFound: 251,
            docs: [{ genome_id: "1.1", genome_name: "One" }],
          },
          facet_counts: {
            facet_fields: field ? { [field]: [`${field} value`, 3] } : {},
          },
        });
      }),
    );

    const result = await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).collection("genome", {
      operation: "collection",
      page: 2,
      pageSize: 200,
      keyword: "coli",
      fields: ["genome_id", "genome_name"],
      facets: ["genus", "genome_status", "host_name"],
      sort: { field: "genome_name", direction: "asc" },
    });

    expect(requested).toHaveLength(3);
    const urls = requested.map((request) => decodeURIComponent(request.url));
    // The rows ride with the first facet; the others read one id each over
    // the same predicate, unsorted.
    expect(urls[0]).toContain("facet(genus,");
    expect(requested[0].headers.get("Range")).toBe("items=200-400");
    for (const [index, field] of ["genome_status", "host_name"].entries()) {
      const url = urls[index + 1];
      expect(url).toContain(`facet(${field},`);
      expect(url).toContain("coli");
      expect(url).toContain("select(genome_id)");
      expect(url).not.toContain("sort(");
      expect(requested[index + 1].headers.get("Range")).toBe("items=0-1");
    }
    expect(result).toEqual({
      rows: [{ genome_id: "1.1", genome_name: "One" }],
      total: 251,
      facets: {
        genus: [{ value: "genus value", count: 3 }],
        genome_status: [{ value: "genome_status value", count: 3 }],
        host_name: [{ value: "host_name value", count: 3 }],
      },
      page: 2,
      pageSize: 200,
    });
  });

  it("counts a facet asked for more than once with one upstream read", async () => {
    const requested: Request[] = [];
    server.use(
      http.get("https://data.test/genome/", ({ request }) => {
        requested.push(request);
        const field = /facet\((\w+),/.exec(decodeURIComponent(request.url))?.[1];
        return HttpResponse.json({
          response: { numFound: 251, docs: [{ genome_id: "1.1" }] },
          facet_counts: {
            facet_fields: field ? { [field]: [`${field} value`, 3] } : {},
          },
        });
      }),
    );
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
    });

    const result = await repository.collection("genome", {
      operation: "collection",
      fields: ["genome_id"],
      facets: ["genus", "genus", "host_name", "genus"],
    });

    expect(requested).toHaveLength(2);
    expect(result.facets).toEqual({
      genus: [{ value: "genus value", count: 3 }],
      host_name: [{ value: "host_name value", count: 3 }],
    });

    // One distinct facet is one read, which names it once.
    requested.length = 0;
    await repository.collection("genome", {
      operation: "collection",
      fields: ["genome_id"],
      facets: ["genus", "genus"],
    });
    expect(requested).toHaveLength(1);
    expect(decodeURIComponent(requested[0].url)).toContain(
      "facet(genus,(mincount,1)",
    );
  });

  it("breaks a sort's ties with its next keys, in order, before the id", async () => {
    const requested = captureGets("genome_feature");

    await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).collection("genome_feature", {
      operation: "collection",
      sort: {
        field: "genome_name",
        direction: "asc",
        then: [
          { field: "accession", direction: "asc" },
          { field: "start", direction: "desc" },
        ],
      },
    });

    expect(requested).toHaveLength(1);
    expect(decodeURIComponent(requested[0].url)).toContain(
      "sort(+genome_name,+accession,-start,+feature_id)",
    );
  });

  it.each([
    ["its first key", { field: "feature_id", direction: "desc" }, "-feature_id"],
    [
      "a tie-breaking key",
      {
        field: "genome_name",
        direction: "asc",
        then: [{ field: "feature_id", direction: "desc" }],
      },
      "+genome_name,-feature_id",
    ],
  ] as const)(
    "does not repeat the id when %s is the id",
    async (_key, sort, clauses) => {
      const requested = captureGets("genome_feature");

      await new ServerDataRepository({
        baseUrl: "https://data.test",
      }).collection("genome_feature", {
        operation: "collection",
        sort,
      });

      expect(requested).toHaveLength(1);
      expect(decodeURIComponent(requested[0].url)).toContain(
        `sort(${clauses})`,
      );
    },
  );

  it("omits projection when a field starts with a digit", async () => {
    const requested = captureGets("strain", {
      response: {
        numFound: 1,
        docs: [
          {
            id: "strain-1",
            strain: "A/test/1/2024",
            "1_pb2": ["CY000001"],
            unrequested_field: "must not escape",
          },
        ],
      },
    });

    const result = await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).collection("strain", {
      operation: "collection",
      fields: ["strain", "1_pb2"],
    });

    expect(requested).toHaveLength(1);
    expect(requested[0].url).not.toContain("select(");
    expect(result.rows).toEqual([
      {
        id: "strain-1",
        strain: "A/test/1/2024",
        "1_pb2": ["CY000001"],
      },
    ]);
  });

  it("includes the required resource ID in narrow export projections", async () => {
    const requested = captureGets("genome", [
      { genome_id: "1.1", genome_name: "One" },
    ]);

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).export(
        "genome",
        {
          operation: "export",
          fields: ["genome_name"],
          limit: 10,
        },
      ),
    ).resolves.toEqual({
      rows: [{ genome_id: "1.1", genome_name: "One" }],
    });

    expect(requested).toHaveLength(1);
    expect(requested[0].url).toContain("select(genome_name,genome_id)");
  });

  it("applies the requested offset to export ranges", async () => {
    const requested = captureGets("genome", [{ genome_id: "10000" }]);

    await new ServerDataRepository({ baseUrl: "https://data.test" }).export(
      "genome",
      {
        operation: "export",
        fields: ["genome_id"],
        limit: 10_000,
        offset: 10_000,
      },
    );

    expect(requested).toHaveLength(1);
    expect(requested[0].headers.get("Range")).toBe("items=10000-20000");
  });

  it("uses tokenized prefix matching for keywords", async () => {
    const requested = captureGets("genome");

    await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).collection("genome", {
      operation: "collection",
      keyword: "influenza virus",
    });

    expect(requested).toHaveLength(1);
    expect(requested[0].url).toContain(
      "and(keyword(influenza%2A),keyword(virus%2A))",
    );
  });

  it("anchors a keyword of only negations beside a scope", async () => {
    // The Data API brackets the keyword clauses, and a bracketed group with no
    // positive clause matches nothing: genome 83332.12's features without
    // hypothetical and putative are 8,141, and(not(...),not(...)) nested 0.
    const requested = captureGets("genome_feature");

    await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).collection("genome_feature", {
      operation: "collection",
      rql: "eq(genome_id,83332.12)",
      keyword: "NOT hypothetical NOT putative",
      keywordMode: "exact",
    });

    expect(requested).toHaveLength(1);
    expect(decodeURIComponent(new URL(requested[0].url).search)).toContain(
      "and(eq(genome_id,83332.12),and(keyword(*),not(keyword(hypothetical)),not(keyword(putative))))",
    );
  });

  it("supports exact keyword matching for resources with that legacy contract", async () => {
    const requested = captureGets("taxonomy");

    await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).collection("taxonomy", {
      operation: "collection",
      keyword: "influenza virus",
      keywordMode: "exact",
    });

    expect(requested).toHaveLength(1);
    expect(requested[0].url).toContain("and(keyword(influenza),keyword(virus))");
    expect(requested[0].url).not.toContain("%2A");
  });

  it("forwards auth and returns null for a missing member", async () => {
    const requested = captureGets("epitope", []);

    await expect(
      new ServerDataRepository({
        baseUrl: "https://data.test/",
        token: "raw-token",
      }).member("epitope", { operation: "member", id: "12" }),
    ).resolves.toEqual({ row: null });
    expect(requested).toHaveLength(1);
    expect(requested[0].headers.get("Authorization")).toBe("raw-token");
  });

  it.each([{ response: { unsupported: [] } }, { items: null }, { rows: {} }])(
    "rejects unsupported row envelopes",
    async (payload) => {
      captureGets("genome", payload);

      await expect(
        new ServerDataRepository({ baseUrl: "https://data.test" }).member(
          "genome",
          { operation: "member", id: "1" },
        ),
      ).rejects.toMatchObject({ code: "malformed_response" });
    },
  );

  it.each([null, true, "", -1, Number.POSITIVE_INFINITY])(
    "rejects invalid facet count %j",
    async (count) => {
      captureGets("genome", {
        response: { numFound: 0, docs: [] },
        facet_counts: { facet_fields: { genus: ["Escherichia", count] } },
      });

      await expect(
        new ServerDataRepository({ baseUrl: "https://data.test" }).collection(
          "genome",
          { operation: "collection", facets: ["genus"] },
        ),
      ).rejects.toMatchObject({ code: "malformed_response" });
    },
  );

  it("requires HTTPS and disables redirects for authenticated requests", async () => {
    let insecureRequests = 0;
    server.use(
      http.all("http://data.test/*", () => {
        insecureRequests += 1;
        return HttpResponse.json([]);
      }),
    );

    await expect(
      new ServerDataRepository({
        baseUrl: "http://data.test",
        token: "raw-token",
      }).member("epitope", { operation: "member", id: "12" }),
    ).rejects.toThrow(/HTTPS/);
    expect(insecureRequests).toBe(0);

    const requested = captureGets("epitope", []);
    await new ServerDataRepository({
      baseUrl: "https://data.test",
      token: "raw-token",
    }).member("epitope", { operation: "member", id: "12" });

    expect(requested).toHaveLength(1);
    expect(requested[0].redirect).toBe("error");
  });

  it("validates genome fields used by consumers", async () => {
    captureGets("genome", [{ genome_name: "missing id" }]);

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).member(
        "genome",
        { operation: "member", id: "1" },
      ),
    ).rejects.toThrow(/Malformed genome response/);
  });

  it.each([401, 403])("preserves inaccessible status %s", async (status) => {
    captureGets("genome", { message: "Inaccessible" }, { status });

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).member(
        "genome",
        { operation: "member", id: "1.1" },
      ),
    ).rejects.toMatchObject({ status });
  });

  it("retains a concise meaningful upstream error", async () => {
    captureGets(
      "genome",
      { error: { msg: "Invalid query near genome_id\nstack details" } },
      { status: 400 },
    );

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).member(
        "genome",
        { operation: "member", id: "1" },
      ),
    ).rejects.toMatchObject({
      message: "Invalid query near genome_id stack details",
      status: 502,
      code: "upstream_error",
    });
  });

  it("recognizes a nested upstream service outage", async () => {
    captureGets(
      "protein_structure",
      {
        status: 500,
        message:
          "Unable to parse the query response. <html><body><h1>503 Service Unavailable</h1> No server is available to handle this request. </body></html>",
      },
      { status: 500 },
    );

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).collection(
        "protein_structure",
        { operation: "collection", rql: "eq(pdb_id,*)" },
      ),
    ).rejects.toMatchObject({
      // The real cause stays: the gateway's 500, and the 503 page it quoted.
      message:
        "The BV-BRC data service is unavailable (HTTP 500 Internal Server Error: 503 Service Unavailable).",
      status: 503,
      code: "service_unavailable",
    });
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
  ] as const)("preserves safe upstream status %i", async (status, code) => {
    captureGets("genome", { message: "Upstream denied request" }, { status });

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).member(
        "genome",
        { operation: "member", id: "1" },
      ),
    ).rejects.toMatchObject({
      status,
      code,
      message: "Upstream denied request",
    });
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
  ] as const)(
    "does not classify safe upstream status %i as a service outage from its message",
    async (status, code) => {
      const message = "No server is available to handle this request";
      captureGets("genome", { message }, { status });

      await expect(
        new ServerDataRepository({ baseUrl: "https://data.test" }).member(
          "genome",
          { operation: "member", id: "1" },
        ),
      ).rejects.toMatchObject({ status, code, message });
    },
  );

  it("forwards abort signals and cache options to the upstream request", async () => {
    const requested = captureGets("genome", [{ genome_id: "1.1" }]);
    // `next` is Next.js's extension to fetch's init: it never reaches the
    // Request MSW sees, so only the call shows it. The spy passes through to
    // MSW, so the request still goes over the intercepted wire.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    onTestFinished(() => {
      fetchSpy.mockRestore();
    });
    const controller = new AbortController();

    await new ServerDataRepository({
      baseUrl: "https://data.test",
      cache: "force-cache",
      revalidate: 300,
    }).member("genome", { operation: "member", id: "1.1" }, controller.signal);
    // The Request's signal follows the caller's, so aborting it now shows the
    // two are linked.
    controller.abort();

    expect(requested).toHaveLength(1);
    expect(requested[0].cache).toBe("force-cache");
    expect(requested[0].signal.aborted).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ next: { revalidate: 300 } }),
    );
  });

  // `operation: "selected"` is the selected-row export path. It used to live in
  // DataTable as a hand-built raw GET against NEXT_PUBLIC_DATA_API; plan item 20A
  // deleted that fallback and routed the behaviour through here, so these four
  // cases are the successors to the ones deleted with it — including the named
  // ERR_FAILED regression guard, which is why the request must be a POST with the
  // predicate in the body rather than a GET with it in the URL.
  //
  // MSW rather than an injected fetcher: the assertions are about the request on
  // the wire (method, body, Range header), so they have to be read off a real
  // Request.
  describe("selected-row export (rows)", () => {
    function repository(): ServerDataRepository {
      return new ServerDataRepository({ baseUrl: "https://data.test" });
    }

    interface CapturedRequest {
      method: string;
      url: string;
      body: string;
      range: string | null;
      contentType: string | null;
    }

    /** Capture the single upstream request `selected` makes for `resource`. */
    function captureSelected(
      resource: string,
      rows: Record<string, unknown>[] | { items: Record<string, unknown>[] },
    ): CapturedRequest {
      const captured: CapturedRequest = {
        method: "",
        url: "",
        body: "",
        range: null,
        contentType: null,
      };
      server.use(
        http.post(`https://data.test/${resource}/`, async ({ request }) => {
          captured.method = request.method;
          captured.url = request.url;
          captured.body = await request.text();
          captured.range = request.headers.get("Range");
          captured.contentType = request.headers.get("Content-Type");
          return HttpResponse.json(rows);
        }),
      );
      return captured;
    }

    it("POSTs the id predicate in the body, keyed off the registry idField", async () => {
      // genome's idField is genome_id, not the literal "id" — the deleted
      // DataTable fallback got this from a per-resource table of its own.
      const captured = captureSelected("genome", [
        { genome_id: "1234.1", genome_name: "One" },
      ]);

      await expect(
        repository().execute("genome", {
          operation: "selected",
          ids: ["1234.1"],
          fields: ["genome_name"],
        }),
      ).resolves.toEqual({
        rows: [{ genome_id: "1234.1", genome_name: "One" }],
      });

      expect(captured.method).toBe("POST");
      expect(captured.body).toBe("in(genome_id,(1234.1))");
      expect(captured.contentType).toBe(
        "application/rqlquery+x-www-form-urlencoded",
      );
      // The predicate must not also travel in the URL — that is the shape that
      // blew the length limit.
      expect(captured.url).not.toContain("in(genome_id");
    });

    it("uses each resource's own idField rather than a shared one", async () => {
      const captured = captureSelected("protein_feature", [
        { id: "aaaa-0001", source: "Pfam" },
      ]);

      await repository().execute("protein_feature", {
        operation: "selected",
        ids: ["aaaa-0001", "aaaa-0002"],
      });

      expect(captured.body).toBe("in(id,(aaaa-0001,aaaa-0002))");
    });

    it("sets the Range header to the selected count, not the page size", async () => {
      const captured = captureSelected("protein_feature", [
        { id: "aaaa-0001" },
        { id: "aaaa-0002" },
      ]);

      await repository().execute("protein_feature", {
        operation: "selected",
        ids: ["aaaa-0001", "aaaa-0002"],
      });

      expect(captured.range).toBe("items=0-2");
    });

    it("accepts an {items:[...]} envelope as well as a bare array", async () => {
      const captured = captureSelected("protein_feature", {
        items: [{ id: "aaaa-0001", source: "Pfam" }],
      });

      await expect(
        repository().execute("protein_feature", {
          operation: "selected",
          ids: ["aaaa-0001"],
        }),
      ).resolves.toEqual({ rows: [{ id: "aaaa-0001", source: "Pfam" }] });
      expect(captured.method).toBe("POST");
    });

    it("regression: 200 selected ids travel intact in the POST body", async () => {
      // The GET-with-RQL-in-the-URL shape this replaced exceeded browser and
      // server URL limits at this volume and failed with net::ERR_FAILED.
      const ids = Array.from(
        { length: 200 },
        (_, index) => `id-${String(index).padStart(4, "0")}`,
      );
      const captured = captureSelected(
        "protein_feature",
        ids.map((id) => ({ id })),
      );

      const result = await repository().execute("protein_feature", {
        operation: "selected",
        ids,
      });

      expect(captured.body.startsWith("in(id,(")).toBe(true);
      expect(captured.body).toContain("id-0000");
      expect(captured.body).toContain("id-0199");
      expect(captured.url).not.toContain("id-0199");
      expect(captured.range).toBe("items=0-200");
      expect(result).toEqual({ rows: ids.map((id) => ({ id })) });
    });
  });

  // These use MSW (real network-level interception via global fetch) rather
  // than an injected fetcher, so `response.json()` runs against a genuine
  // HTTP response — exercising the actual parse-failure-to-null path in
  // `request()`, not a stand-in for it.
  describe("normalizeRows rejects malformed successful responses", () => {
    const genomeUrl = "https://data.test/genome/";

    function repository(): ServerDataRepository {
      return new ServerDataRepository({ baseUrl: "https://data.test" });
    }

    const malformedBodies: [string, () => Response][] = [
      [
        "unparseable JSON (the request layer maps the parse failure to null)",
        () =>
          new HttpResponse("<html>not json</html>", {
            headers: { "Content-Type": "application/json" },
          }),
      ],
      ["a JSON null body", () => HttpResponse.json(null)],
      ["a bare JSON string", () => HttpResponse.json("unexpected")],
      ["a bare JSON number", () => HttpResponse.json(42)],
      ["a bare JSON boolean", () => HttpResponse.json(false)],
      [
        "an unknown object envelope",
        () => HttpResponse.json({ mystery: "shape" }),
      ],
    ];

    it.each(malformedBodies)(
      "rejects a collection request when the body is %s",
      async (_label, makeResponse) => {
        server.use(http.get(genomeUrl, () => makeResponse()));
        await expect(
          repository().collection("genome", { operation: "collection" }),
        ).rejects.toMatchObject({
          name: "DataApiError",
          code: "malformed_response",
        });
      },
    );

    it.each(malformedBodies)(
      "rejects a member request when the body is %s",
      async (_label, makeResponse) => {
        server.use(http.get(genomeUrl, () => makeResponse()));
        await expect(
          repository().member("genome", { operation: "member", id: "1.1" }),
        ).rejects.toMatchObject({
          name: "DataApiError",
          code: "malformed_response",
        });
      },
    );

    it.each(malformedBodies)(
      "rejects an export request when the body is %s",
      async (_label, makeResponse) => {
        server.use(http.get(genomeUrl, () => makeResponse()));
        await expect(
          repository().export("genome", {
            operation: "export",
            fields: ["genome_id"],
            limit: 10,
          }),
        ).rejects.toMatchObject({
          name: "DataApiError",
          code: "malformed_response",
        });
      },
    );

    it("still treats an empty array as a legitimate empty collection", async () => {
      server.use(http.get(genomeUrl, () => HttpResponse.json([])));
      await expect(
        repository().collection("genome", { operation: "collection" }),
      ).resolves.toMatchObject({ rows: [], total: 0 });
    });

    it("still treats an empty array as a legitimate missing member", async () => {
      server.use(http.get(genomeUrl, () => HttpResponse.json([])));
      await expect(
        repository().member("genome", { operation: "member", id: "1.1" }),
      ).resolves.toEqual({ row: null });
    });

    it("still treats an empty array as a legitimate empty export", async () => {
      server.use(http.get(genomeUrl, () => HttpResponse.json([])));
      await expect(
        repository().export("genome", {
          operation: "export",
          fields: ["genome_id"],
          limit: 10,
        }),
      ).resolves.toEqual({ rows: [] });
    });
  });
  // genome_amr is the one registry resource with no row fixture anywhere in
  // this repo, and `parseRows` turns a schema mismatch into a 502 that blanks
  // the whole AMR list. These pin the shapes its columns actually arrive in, so
  // the deliberately-minimal `genomeAmrRecordSchema` is a checked contract
  // rather than an untested guess.
  describe("genome_amr row shapes", () => {
    const amrUrl = "https://data.test/genome_amr/";
    const amrRepository = () =>
      new ServerDataRepository({ baseUrl: "https://data.test" });

    const amrRow = {
      id: "1a2b3c",
      genome_id: "1313.5678",
      genome_name: "Streptococcus pneumoniae",
      antibiotic: "ampicillin",
      resistant_phenotype: "Resistant",
      // Non-numeric by design: AMR measurements carry the comparison in the
      // value, which is why measurement_value is left string-typed in the
      // registry.
      measurement_value: ">=32",
      measurement_sign: ">=",
      measurement_unit: "mg/L",
      // Lists on rows that cite more than one source.
      pmid: ["12345", "67890"],
      evidence: ["Laboratory Method"],
      laboratory_typing_method: "Broth dilution",
      computational_method: "",
    };

    it("parses a realistic AMR row verbatim, list and non-numeric columns included", async () => {
      server.use(
        http.get(amrUrl, () =>
          HttpResponse.json({ response: { numFound: 1, docs: [amrRow] } }),
        ),
      );

      await expect(
        amrRepository().collection("genome_amr", {
          operation: "collection",
          rql: "keyword(ampicillin%2A)",
          fields: ["id", "antibiotic", "pmid", "measurement_value"],
        }),
      ).resolves.toMatchObject({
        total: 1,
        rows: [
          {
            id: "1a2b3c",
            antibiotic: "ampicillin",
            pmid: ["12345", "67890"],
            measurement_value: ">=32",
          },
        ],
      });
    });

    it("reads an AMR member through the registry idField", async () => {
      const requested: string[] = [];
      server.use(
        http.get(amrUrl, ({ request }) => {
          requested.push(decodeURIComponent(request.url));
          return HttpResponse.json([amrRow]);
        }),
      );

      await expect(
        amrRepository().member("genome_amr", {
          operation: "member",
          id: "1a2b3c",
        }),
      ).resolves.toEqual({ row: amrRow });
      expect(requested[0]).toContain("eq(id,1a2b3c)");
    });

    it("rejects a row with no id, which the list cannot key", async () => {
      server.use(
        http.get(amrUrl, () =>
          HttpResponse.json({
            response: { numFound: 1, docs: [{ antibiotic: "ampicillin" }] },
          }),
        ),
      );

      await expect(
        amrRepository().collection("genome_amr", { operation: "collection" }),
      ).rejects.toMatchObject({
        name: "DataApiError",
        code: "malformed_response",
      });
    });
  });
});

// MSW for the same reason as the selected-row block above: the contract is the
// request on the wire (method, body, Accept, Range) and a body that is passed
// through rather than parsed.
describe("ServerDataRepository.fasta", () => {
  const record =
    ">fig|644340.17.peg.16| Flagellar biosynthesis protein FliQ\nMNEADALDIV\n";

  function captureFasta(resource: string, respond: () => Response) {
    const captured: {
      body: string;
      accept: string | null;
      range: string | null;
      contentType: string | null;
      authorization: string | null;
    }[] = [];
    server.use(
      http.post(`https://data.test/${resource}/`, async ({ request }) => {
        captured.push({
          body: await request.text(),
          accept: request.headers.get("Accept"),
          range: request.headers.get("Range"),
          contentType: request.headers.get("Content-Type"),
          authorization: request.headers.get("Authorization"),
        });
        return respond();
      }),
    );
    return captured;
  }

  it("POSTs the escaped id predicate with the sequence type's Accept and a Range sized to the ids", async () => {
    const captured = captureFasta(
      "genome_feature",
      () =>
        new Response(record, {
          headers: { "Content-Type": "application/protein+fasta" },
        }),
    );
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      token: "secret",
    });

    const body = await repository.fasta("genome_feature", {
      type: "protein",
      ids: ["PATRIC.1.a", "PATRIC.1.b"],
    });

    expect(await new Response(body).text()).toBe(record);
    expect(captured).toEqual([
      {
        body: "in(feature_id,(PATRIC.1.a,PATRIC.1.b))",
        accept: "application/protein+fasta",
        range: "items=0-2",
        contentType: "application/rqlquery+x-www-form-urlencoded",
        authorization: "secret",
      },
    ]);
  });

  it("keys a contig request off genome_sequence's own idField and asks for DNA", async () => {
    const captured = captureFasta(
      "genome_sequence",
      () => new Response(">accn|JAEUGC010000001\nACGT\n"),
    );

    await new ServerDataRepository({ baseUrl: "https://data.test" }).fasta(
      "genome_sequence",
      { type: "dna", ids: ["644340.17.con.0001"] },
    );

    expect(captured).toEqual([
      expect.objectContaining({
        body: "in(sequence_id,(644340.17.con.0001))",
        accept: "application/dna+fasta",
      }),
    ]);
  });

  it("returns an empty stream, not an error, when nothing matched", async () => {
    captureFasta(
      "genome_feature",
      () =>
        new Response("", { headers: { "Content-Range": "items 0-0/0" } }),
    );

    const body = await new ServerDataRepository({
      baseUrl: "https://data.test",
    }).fasta("genome_feature", { type: "dna", ids: ["missing"] });

    expect(await new Response(body).text()).toBe("");
  });

  it("maps an upstream failure the same way as every JSON read", async () => {
    captureFasta("genome_feature", () =>
      HttpResponse.json({ error: "Invalid query" }, { status: 400 }),
    );

    await expect(
      new ServerDataRepository({ baseUrl: "https://data.test" }).fasta(
        "genome_feature",
        { type: "dna", ids: ["PATRIC.1"] },
      ),
    ).rejects.toMatchObject({
      message: "Invalid query",
      status: 502,
      code: "upstream_error",
    });
  });

  it("keeps the HTTPS-with-token guard", async () => {
    await expect(
      new ServerDataRepository({
        baseUrl: "http://data.test",
        token: "secret",
      }).fasta("genome_feature", { type: "dna", ids: ["PATRIC.1"] }),
    ).rejects.toMatchObject({ status: 500, code: "insecure_upstream" });
  });
});
