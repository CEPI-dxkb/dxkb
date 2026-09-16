import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test-helpers/msw-server";
import { ServerDataRepository } from "../repository";

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("ServerDataRepository", () => {
  it("combines rows, count, and facets with exclusive-end range and stable sorting", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        response: {
          numFound: 251,
          docs: [{ genome_id: "1.1", genome_name: "One" }],
        },
        facet_counts: { facet_fields: { genus: ["Escherichia", 20] } },
      }),
    );
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: fetcher,
    });

    const result = await repository.collection("genome", {
      operation: "collection",
      page: 1,
      pageSize: 200,
      rql: "eq(genome_id,1.1)",
      fields: ["genome_id", "genome_name"],
      facets: ["genus"],
      sort: { field: "genome_name", direction: "asc" },
    });

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBeInstanceOf(URL);
    const requestedUrl = (url as URL).href;
    expect(requestedUrl).toContain("eq(genome_id,1.1)");
    expect(requestedUrl).toContain("sort(+genome_name,+genome_id)");
    expect(new Headers(init?.headers).get("Range")).toBe("items=0-200");
    expect(result).toEqual({
      rows: [{ genome_id: "1.1", genome_name: "One" }],
      total: 251,
      facets: { genus: [{ value: "Escherichia", count: 20 }] },
      page: 1,
      pageSize: 200,
    });
  });

  it("omits projection when a field starts with a digit", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
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
      }),
    );
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: fetcher,
    });

    const result = await repository.collection("strain", {
      operation: "collection",
      fields: ["strain", "1_pb2"],
    });

    expect((fetcher.mock.calls[0][0] as URL).href).not.toContain("select(");
    expect(result.rows).toEqual([
      {
        id: "strain-1",
        strain: "A/test/1/2024",
        "1_pb2": ["CY000001"],
      },
    ]);
  });

  it("includes the required resource ID in narrow export projections", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        jsonResponse([{ genome_id: "1.1", genome_name: "One" }]),
      );
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: fetcher,
    });

    await expect(
      repository.export("genome", {
        operation: "export",
        fields: ["genome_name"],
        limit: 10,
      }),
    ).resolves.toEqual({
      rows: [{ genome_id: "1.1", genome_name: "One" }],
    });

    expect((fetcher.mock.calls[0][0] as URL).href).toContain(
      "select(genome_name,genome_id)",
    );
  });

  it("applies the requested offset to export ranges", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ genome_id: "10000" }]));
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: fetcher,
    });

    await repository.export("genome", {
      operation: "export",
      fields: ["genome_id"],
      limit: 10_000,
      offset: 10_000,
    });

    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Range")).toBe(
      "items=10000-20000",
    );
  });

  it("uses tokenized prefix matching for keywords", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ response: { numFound: 0, docs: [] } }));
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: fetcher,
    });

    await repository.collection("genome", {
      operation: "collection",
      keyword: "influenza virus",
    });

    const [url] = fetcher.mock.calls[0];
    expect((url as URL).href).toContain(
      "and(keyword(influenza%2A),keyword(virus%2A))",
    );
  });

  it("supports exact keyword matching for resources with that legacy contract", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ response: { numFound: 0, docs: [] } }));
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: fetcher,
    });

    await repository.collection("taxonomy", {
      operation: "collection",
      keyword: "influenza virus",
      keywordMode: "exact",
    });

    const [url] = fetcher.mock.calls[0];
    expect((url as URL).href).toContain(
      "and(keyword(influenza),keyword(virus))",
    );
    expect((url as URL).href).not.toContain("%2A");
  });

  it("forwards auth and returns null for a missing member", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test/",
      token: "raw-token",
      fetch: fetcher,
    });
    await expect(
      repository.member("epitope", { operation: "member", id: "12" }),
    ).resolves.toEqual({ row: null });
    expect(
      new Headers(fetcher.mock.calls[0][1]?.headers).get("Authorization"),
    ).toBe("raw-token");
  });

  it.each([{ response: { unsupported: [] } }, { items: null }, { rows: {} }])(
    "rejects unsupported row envelopes",
    async (payload) => {
      const repository = new ServerDataRepository({
        baseUrl: "https://data.test",
        fetch: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload)),
      });

      await expect(
        repository.member("genome", { operation: "member", id: "1" }),
      ).rejects.toMatchObject({ code: "malformed_response" });
    },
  );

  it.each([null, true, "", -1, Number.POSITIVE_INFINITY])(
    "rejects invalid facet count %j",
    async (count) => {
      const repository = new ServerDataRepository({
        baseUrl: "https://data.test",
        fetch: vi.fn<typeof fetch>().mockResolvedValue(
          jsonResponse({
            response: { numFound: 0, docs: [] },
            facet_counts: { facet_fields: { genus: ["Escherichia", count] } },
          }),
        ),
      });

      await expect(
        repository.collection("genome", {
          operation: "collection",
          facets: ["genus"],
        }),
      ).rejects.toMatchObject({ code: "malformed_response" });
    },
  );

  it("requires HTTPS and disables redirects for authenticated requests", async () => {
    const insecureFetcher = vi.fn<typeof fetch>();
    const insecureRepository = new ServerDataRepository({
      baseUrl: "http://data.test",
      token: "raw-token",
      fetch: insecureFetcher,
    });

    await expect(
      insecureRepository.member("epitope", {
        operation: "member",
        id: "12",
      }),
    ).rejects.toThrow(/HTTPS/);
    expect(insecureFetcher).not.toHaveBeenCalled();

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([]));
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      token: "raw-token",
      fetch: fetcher,
    });
    await repository.member("epitope", { operation: "member", id: "12" });

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("validates genome fields used by consumers", async () => {
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(jsonResponse([{ genome_name: "missing id" }])),
    });
    await expect(
      repository.member("genome", { operation: "member", id: "1" }),
    ).rejects.toThrow(/Malformed genome response/);
  });

  it.each([401, 403])("preserves inaccessible status %s", async (status) => {
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ message: "Inaccessible" }, { status }),
        ),
    });

    await expect(
      repository.member("genome", { operation: "member", id: "1.1" }),
    ).rejects.toMatchObject({ status });
  });

  it("retains a concise meaningful upstream error", async () => {
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse(
            { error: { msg: "Invalid query near genome_id\nstack details" } },
            { status: 400 },
          ),
        ),
    });
    await expect(
      repository.member("genome", { operation: "member", id: "1" }),
    ).rejects.toMatchObject({
      message: "Invalid query near genome_id stack details",
      status: 502,
      code: "upstream_error",
    });
  });

  it("recognizes a nested upstream service outage", async () => {
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            status: 500,
            message:
              "Unable to parse the query response. <html><body><h1>503 Service Unavailable</h1> No server is available to handle this request. </body></html>",
          },
          { status: 500 },
        ),
      ),
    });

    await expect(
      repository.collection("protein_structure", {
        operation: "collection",
        rql: "eq(pdb_id,*)",
      }),
    ).rejects.toMatchObject({
      message: "The data service is temporarily unavailable. Please try again.",
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
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ message: "Upstream denied request" }, { status }),
        ),
    });

    await expect(
      repository.member("genome", { operation: "member", id: "1" }),
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
      const repository = new ServerDataRepository({
        baseUrl: "https://data.test",
        fetch: vi
          .fn<typeof fetch>()
          .mockResolvedValue(jsonResponse({ message }, { status })),
      });

      await expect(
        repository.member("genome", { operation: "member", id: "1" }),
      ).rejects.toMatchObject({ status, code, message });
    },
  );

  it("forwards abort signals and cache options to the upstream request", async () => {
    const signal = new AbortController().signal;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse([{ genome_id: "1.1" }]));
    const repository = new ServerDataRepository({
      baseUrl: "https://data.test",
      fetch: fetcher,
      cache: "force-cache",
      revalidate: 300,
    });

    await repository.member(
      "genome",
      { operation: "member", id: "1.1" },
      signal,
    );

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        signal,
        cache: "force-cache",
        next: { revalidate: 300 },
      }),
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
