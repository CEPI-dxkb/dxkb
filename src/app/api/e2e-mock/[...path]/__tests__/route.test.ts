import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { DELETE, GET, POST, PUT } from "../route";

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

function ctx(path: string[]): RouteContext {
  return { params: Promise.resolve({ path }) };
}

interface SolrPivotEntry {
  field: string;
  value: string | number;
  pivot?: SolrPivotEntry[];
  count?: number;
}

interface SolrFacetBody {
  facet_counts: {
    facet_fields: Record<string, (string | number)[]>;
    facet_pivot: Record<string, SolrPivotEntry[]>;
  };
}

const originalMockEnabled = process.env.E2E_MOCK_ENABLED;

afterEach(() => {
  if (originalMockEnabled === undefined) {
    delete process.env.E2E_MOCK_ENABLED;
  } else {
    process.env.E2E_MOCK_ENABLED = originalMockEnabled;
  }
});

describe("api/e2e-mock catch-all — guard", () => {
  it.each(["0", "", "true", "false"])(
    "returns 404 when E2E_MOCK_ENABLED is %p (anything other than '1')",
    async (flag) => {
      process.env.E2E_MOCK_ENABLED = flag;

      const getResp = await GET(
        mockNextRequest({ url: "http://localhost:3020/api/e2e-mock/foo" }),
        ctx(["foo"]),
      );
      expect(getResp.status).toBe(404);
      expect((await getResp.json()) as unknown).toEqual({
        error: "Mock endpoint disabled",
      });

      const postResp = await POST(
        mockNextRequest({
          method: "POST",
          body: { method: "x" },
          url: "http://localhost:3020/api/e2e-mock/foo",
        }),
        ctx(["foo"]),
      );
      expect(postResp.status).toBe(404);
    },
  );

  it("returns 404 when E2E_MOCK_ENABLED is unset", async () => {
    delete process.env.E2E_MOCK_ENABLED;

    const resp = await GET(
      mockNextRequest({ url: "http://localhost:3020/api/e2e-mock/anything" }),
      ctx(["anything"]),
    );
    expect(resp.status).toBe(404);
  });
});

describe("api/e2e-mock catch-all — enabled", () => {
  beforeEach(() => {
    process.env.E2E_MOCK_ENABLED = "1";
  });

  it("GET returns 200 with empty object", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/app-service/foo",
      }),
      ctx(["app-service", "foo"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toEqual({});
  });

  it("returns protein structure fixtures for collections and exact members", async () => {
    const unfilteredResp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/protein_structure/",
      }),
      ctx(["data", "protein_structure"]),
    );
    const collectionResp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/protein_structure/?eq(pdb_id,*)",
      }),
      ctx(["data", "protein_structure"]),
    );
    const memberResp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/protein_structure/?eq(pdb_id,6VXX)",
      }),
      ctx(["data", "protein_structure"]),
    );

    await expect(unfilteredResp.json()).resolves.toMatchObject({
      response: {
        numFound: 2,
        docs: [{ pdb_id: "6VXX" }, { pdb_id: "7BV2" }],
      },
    });
    await expect(collectionResp.json()).resolves.toMatchObject({
      response: {
        numFound: 2,
        docs: [{ pdb_id: "6VXX" }, { pdb_id: "7BV2" }],
      },
    });
    await expect(memberResp.json()).resolves.toMatchObject({
      response: { numFound: 1, docs: [{ pdb_id: "6VXX" }] },
    });
  });

  it.each([
    ["unfiltered", ""],
    ["wildcard", "?eq(exp_id,*)"],
    ["keyword", "?keyword(RNA*)"],
  ])(
    "returns the experiment fixture for a supported %s collection query",
    async (_name, query) => {
      const resp = await GET(
        mockNextRequest({
          url: `http://localhost:3020/api/e2e-mock/data/experiment/${query}`,
        }),
        ctx(["data", "experiment"]),
      );

      await expect(resp.json()).resolves.toMatchObject({
        response: { numFound: 1, docs: [{ exp_id: "2000000" }] },
      });
    },
  );

  it("returns the experiment fixture for the matching exact member", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/experiment/?eq(exp_id,2000000)",
      }),
      ctx(["data", "experiment"]),
    );

    await expect(resp.json()).resolves.toMatchObject({
      response: { numFound: 1, docs: [{ exp_id: "2000000" }] },
    });
  });

  it("returns zero experiments for an unmatched exact member", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/experiment/?eq(exp_id,9999999)",
      }),
      ctx(["data", "experiment"]),
    );

    await expect(resp.json()).resolves.toEqual({
      response: { numFound: 0, docs: [] },
    });
  });

  it("filters ambiguous surveillance fixtures by pathogen test type", async () => {
    const unfilteredResp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/surveillance/?eq(sample_identifier,ambiguous-sample)",
      }),
      ctx(["data", "surveillance"]),
    );
    const filteredResp = await GET(
      mockNextRequest({
        url: 'http://localhost:3020/api/e2e-mock/data/surveillance/?and(eq(sample_identifier,ambiguous-sample),eq(pathogen_test_type,"RAT%2Fantigen"))',
      }),
      ctx(["data", "surveillance"]),
    );
    const unmatchedResp = await GET(
      mockNextRequest({
        url: 'http://localhost:3020/api/e2e-mock/data/surveillance/?and(eq(sample_identifier,ambiguous-sample),eq(pathogen_test_type,"LAMP"))',
      }),
      ctx(["data", "surveillance"]),
    );

    await expect(unfilteredResp.json()).resolves.toMatchObject({
      response: { numFound: 2 },
    });
    await expect(filteredResp.json()).resolves.toMatchObject({
      response: {
        numFound: 1,
        docs: [{ pathogen_test_type: ["RAT/antigen"] }],
      },
    });
    await expect(unmatchedResp.json()).resolves.toMatchObject({
      response: { numFound: 0, docs: [] },
    });
  });

  it.each(["Western blot", "ELISA/IgG test"])(
    "filters ambiguous serology fixtures by test type: %s",
    async (testType) => {
      const filteredResp = await GET(
        mockNextRequest({
          url: `http://localhost:3020/api/e2e-mock/data/serology/?and(eq(sample_identifier,ambiguous-serology),eq(test_type,${encodeURIComponent(testType)}))`,
        }),
        ctx(["data", "serology"]),
      );

      await expect(filteredResp.json()).resolves.toMatchObject({
        response: {
          numFound: 1,
          docs: [{ test_type: testType }],
        },
      });
    },
  );

  it("returns the surveillance fixture for a wildcard keyword query", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/surveillance/?keyword(sentinel*)",
      }),
      ctx(["data", "surveillance"]),
    );

    await expect(resp.json()).resolves.toMatchObject({
      response: {
        numFound: 1,
        docs: [{ sample_identifier: "sample/1" }],
      },
    });
  });

  it("GET returns bacteria summary fixtures for the BV-BRC website mock", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/data/summary_by_taxon/2",
      }),
      ctx(["bvbrc-website", "data", "summary_by_taxon", "2"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      count: 1337420,
      unique_genus: 5432,
      PDB: 9821,
    });
  });

  it("GET returns viruses summary fixtures for taxonId 10239", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/data/summary_by_taxon/10239",
      }),
      ctx(["bvbrc-website", "data", "summary_by_taxon", "10239"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      count: 890123,
      unique_family: 212,
    });
  });

  it("GET returns all organisms summary fixtures for taxonId 131567", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/data/summary_by_taxon/131567",
      }),
      ctx(["bvbrc-website", "data", "summary_by_taxon", "131567"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      count: 9800000,
      unique_family: 1204,
    });
  });

  it("GET returns SOLR-shaped bacteria genome facet fixtures", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,2)&limit(1)&facet%28%28field%2Cgenus%29%2C%28limit%2C24%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      response?: { numFound?: number };
      facet_counts?: { facet_fields?: { genus?: unknown[] } };
    };
    expect(body).toMatchObject({
      response: { numFound: 1337420 },
      facet_counts: { facet_fields: { genus: expect.any(Array) as unknown } },
    });
    expect(body.facet_counts?.facet_fields?.genus).toEqual(
      expect.arrayContaining(["Escherichia", 128450]),
    );
  });

  it("GET returns SOLR-shaped family facet fixtures", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,10239)&limit(1)&facet%28%28field%2Cfamily%29%2C%28limit%2C24%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      facet_counts?: { facet_fields?: { family?: unknown[] } };
    };
    expect(body).toMatchObject({
      facet_counts: { facet_fields: { family: expect.any(Array) as unknown } },
    });
    expect(body.facet_counts?.facet_fields?.family).toEqual(
      expect.arrayContaining(["Coronaviridae", 180204]),
    );
  });

  it("GET returns SOLR-shaped host_group facet fixtures", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,131567)&limit(1)&facet%28%28field%2Chost_group%29%2C%28limit%2C24%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as {
      facet_counts?: { facet_fields?: { host_group?: unknown[] } };
    };
    expect(body).toMatchObject({
      facet_counts: {
        facet_fields: { host_group: expect.any(Array) as unknown },
      },
    });
    expect(body.facet_counts?.facet_fields?.host_group).toEqual(
      expect.arrayContaining(["Human", 512004]),
    );
  });

  it("POST returns 200 with JSON-RPC-shaped empty result", async () => {
    const resp = await POST(
      mockNextRequest({
        method: "POST",
        body: { id: 1, jsonrpc: "2.0", method: "Workspace.ls", params: [] },
        url: "http://localhost:3020/api/e2e-mock/workspace",
      }),
      ctx(["workspace"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toEqual({
      id: 1,
      jsonrpc: "2.0",
      result: [[]],
    });
  });

  it("GET returns a valid BV-BRC profile for server-side session hydration", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/user/e2e-test-user%40patricbrc.org",
      }),
      ctx(["user", "e2e-test-user%40patricbrc.org"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      id: "e2e-test-user@patricbrc.org",
      email: "e2e@example.com",
      email_verified: true,
      roles: ["admin"],
    });
  });

  it("GET returns the distinct target profile requested by SU login", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/user/e2e-target-user",
      }),
      ctx(["user", "e2e-target-user"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      id: "e2e-target-user@patricbrc.org",
      email: "target@example.com",
      l_id: "e2e-target-user",
      roles: [],
    });
  });

  it("GET returns 404 instead of substituting an identity for an unknown profile", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/user/missing-user",
      }),
      ctx(["user", "missing-user"]),
    );

    expect(resp.status).toBe(404);
    expect((await resp.json()) as unknown).toEqual({ error: "User not found" });
  });

  it("POST user-auth returns the admin identity token", async () => {
    const resp = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3020/api/e2e-mock/user-auth",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        rawBody: "username=e2e-test-user&password=password1234",
      }),
      ctx(["user-auth"]),
    );

    expect(resp.status).toBe(200);
    expect(resp.headers.get("Authorization")).toBe(
      "un=e2e-test-user@patricbrc.org|e2e-admin-token",
    );
    expect(await resp.text()).toBe(
      "un=e2e-test-user@patricbrc.org|e2e-admin-token",
    );
  });

  it("POST user-auth/sulogin returns a token for the requested target", async () => {
    const resp = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3020/api/e2e-mock/user-auth/sulogin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        rawBody:
          "username=e2e-test-user%40patricbrc.org&targetUser=e2e-target-user&password=password1234",
      }),
      ctx(["user-auth", "sulogin"]),
    );

    expect(resp.status).toBe(200);
    expect(await resp.text()).toBe(
      "un=e2e-target-user@patricbrc.org|e2e-target-token",
    );
  });

  it("POST user-auth/sulogin rejects an unknown target", async () => {
    const resp = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3020/api/e2e-mock/user-auth/sulogin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        rawBody:
          "username=e2e-test-user%40patricbrc.org&targetUser=missing-user&password=password1234",
      }),
      ctx(["user-auth", "sulogin"]),
    );

    expect(resp.status).toBe(401);
    expect(await resp.text()).toBe("Invalid SU login");
  });

  it.each(["user-password-reset", "user-verification"])(
    "POST %s returns an acknowledgement instead of JSON-RPC",
    async (identityPath) => {
      const resp = await POST(
        mockNextRequest({
          method: "POST",
          body: { id: "e2e-test-user@patricbrc.org" },
          url: `http://localhost:3020/api/e2e-mock/${identityPath}`,
        }),
        ctx([identityPath]),
      );

      expect(resp.status).toBe(200);
      expect((await resp.json()) as unknown).toEqual({ success: true });
    },
  );

  it("POST handles non-JSON bodies without throwing", async () => {
    const resp = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3020/api/e2e-mock/upload",
        headers: { "Content-Type": "text/plain" },
        rawBody: "raw text",
      }),
      ctx(["upload"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toEqual({
      id: 1,
      jsonrpc: "2.0",
      result: [[]],
    });
  });

  it("GET returns the Genome collection fixture for the expected MERS query", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/genome/?keyword(MERS*)&sort(+genome_name,+genome_id)",
      }),
      ctx(["data", "genome"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      response: {
        docs: [{ genome_id: "1282460.2049" }],
      },
    });
  });

  it("GET omits the Genome fixture when Range excludes its row", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/genome/?keyword(MERS*)&sort(+genome_name,+genome_id)",
        headers: { Range: "items=200-400" },
      }),
      ctx(["data", "genome"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      response: { numFound: 12345, docs: [] },
    });
  });

  it("GET returns an empty JSON array when X-Range excludes the Genome fixture", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/genome/?keyword(MERS*)&sort(+genome_name,+genome_id)",
        headers: {
          Accept: "application/json",
          "X-Range": "items=200-400",
        },
      }),
      ctx(["data", "genome"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toEqual([]);
  });

  it("GET does not return the Genome fixture for an unrelated filtered query", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/data/genome/?eq(taxon_lineage_ids,2)&sort(+genome_name,+genome_id)",
      }),
      ctx(["data", "genome"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      response: { docs: [] },
    });
  });

  it("PUT returns 200 with empty object", async () => {
    const resp = await PUT(
      mockNextRequest({
        method: "PUT",
        body: {},
        url: "http://localhost:3020/api/e2e-mock/foo",
      }),
      ctx(["foo"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toEqual({});
  });

  it("DELETE returns 200 with empty object", async () => {
    const resp = await DELETE(
      mockNextRequest({
        method: "DELETE",
        url: "http://localhost:3020/api/e2e-mock/foo/bar",
      }),
      ctx(["foo", "bar"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toEqual({});
  });

  it("GET returns the reference_genome array fixture (not a SOLR envelope)", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&eq(reference_genome,*)&select(reference_genome,genome_name,genome_id)&limit(25000)",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as Record<string, unknown>[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toMatchObject({
      genome_id: expect.stringMatching(/^234\./) as unknown,
      genome_name: expect.any(String) as unknown,
      reference_genome: expect.stringMatching(
        /Reference|Representative/,
      ) as unknown,
    });
  });

  it("GET disambiguates taxon IDs by regex, not substring", async () => {
    // taxon "234" is a substring of "1234" — the old code would have matched both
    // and returned the geo-specific fixture for "1234". With regex matching,
    // a taxon ID of "1234" falls through to the default fixture.
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,1234)&facet%28%28field%2Cisolation_country%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as SolrFacetBody;
    // Should be the default isolation_country fixture (uses long country names)
    // not the geo-specific one keyed at taxonId=234.
    expect(body.facet_counts.facet_fields.isolation_country).toEqual(
      expect.arrayContaining(["United States", 290442]),
    );
  });

  it("GET applies the geo-specific isolation_country fixture only for taxonId=234", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&facet%28%28field%2Cisolation_country%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as SolrFacetBody;
    // Geo fixture uses 3-letter or short country names ("USA", "China", "Italy")
    expect(body.facet_counts.facet_fields.isolation_country).toEqual(
      expect.arrayContaining(["USA", 260]),
    );
  });

  it.each([
    [
      "isolation_country,genus",
      "facet%28%28pivot%2C%28isolation_country%2Cgenus%29%29%2C%28mincount%2C1%29%29",
    ],
    [
      "isolation_country,host_common_name",
      "facet%28%28pivot%2C%28isolation_country%2Chost_common_name%29%29%2C%28mincount%2C1%29%29",
    ],
    [
      "state_province,genus",
      "facet%28%28pivot%2C%28state_province%2Cgenus%29%29%2C%28mincount%2C1%29%29",
    ],
    [
      "state_province,host_common_name",
      "facet%28%28pivot%2C%28state_province%2Chost_common_name%29%29%2C%28mincount%2C1%29%29",
    ],
    [
      "state_province,county",
      "facet%28%28pivot%2C%28state_province%2Ccounty%29%29%2C%28mincount%2C1%29%29",
    ],
  ])(
    "GET serves the %s pivot with a non-empty facet_pivot",
    async (pivotKey, encoded) => {
      const resp = await GET(
        mockNextRequest({
          url: `http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&${encoded}`,
        }),
        ctx(["bvbrc-website", "genome"]),
      );

      expect(resp.status).toBe(200);
      const body = (await resp.json()) as SolrFacetBody;
      expect(body.facet_counts.facet_pivot[pivotKey]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: expect.any(String) as unknown }),
        ]),
      );
    },
  );

  it("GET serves collection_year,serovar with numeric outer year keys", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,590)&facet%28%28pivot%2C%28collection_year%2Cserovar%29%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as SolrFacetBody;
    const pivot = body.facet_counts.facet_pivot["collection_year,serovar"];
    expect(Array.isArray(pivot)).toBe(true);
    expect(pivot[0]).toMatchObject({
      field: "collection_year",
      value: expect.any(Number) as unknown,
      pivot: expect.arrayContaining([
        expect.objectContaining({ field: "serovar", value: "Typhimurium" }),
      ]) as unknown,
    });
  });

  it("GET returns 400 for an unsupported 2-level pivot key", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&facet%28%28pivot%2C%28state_province%2Cwrong_field%29%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(400);
    expect((await resp.json()) as unknown).toMatchObject({
      error: expect.stringContaining(
        "unhandled bvbrc-website/genome query",
      ) as unknown,
      reason: expect.stringContaining(
        "unsupported pivot key 'state_province,wrong_field'",
      ) as unknown,
    });
  });

  it("GET returns 400 for an unsupported 3-level pivot key", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&facet%28%28pivot%2C%28state_province%2Ccounty%2Cwrong_field%29%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(400);
    expect((await resp.json()) as unknown).toMatchObject({
      error: expect.stringContaining(
        "unhandled bvbrc-website/genome query",
      ) as unknown,
      reason: expect.stringContaining(
        "unsupported pivot key 'state_province,county,wrong_field'",
      ) as unknown,
    });
  });

  it("GET serves a 3-level state_province,county,genus pivot scoped per state", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&facet%28%28pivot%2C%28state_province%2Ccounty%2Cgenus%29%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(200);
    const body = (await resp.json()) as SolrFacetBody;
    const pivot = body.facet_counts.facet_pivot["state_province,county,genus"];
    expect(Array.isArray(pivot)).toBe(true);
    expect(pivot[0]).toMatchObject({
      field: "state_province",
      value: expect.any(String) as unknown,
      pivot: expect.arrayContaining([
        expect.objectContaining({
          field: "county",
          pivot: expect.arrayContaining([
            expect.objectContaining({ field: "genus", value: "Brucella" }),
          ]) as unknown,
        }),
      ]) as unknown,
    });
  });

  it("GET state_province,county and state_province,county,genus pivots share the same county names per state", async () => {
    const twoLevelResp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&facet%28%28pivot%2C%28state_province%2Ccounty%29%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );
    const threeLevelResp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&facet%28%28pivot%2C%28state_province%2Ccounty%2Cgenus%29%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    const twoBody = (await twoLevelResp.json()) as SolrFacetBody;
    const threeBody = (await threeLevelResp.json()) as SolrFacetBody;

    interface PivotEntry {
      value: string;
      pivot?: PivotEntry[];
    }
    const twoLevel: PivotEntry[] = twoBody.facet_counts.facet_pivot[
      "state_province,county"
    ] as unknown as PivotEntry[];
    const threeLevel: PivotEntry[] = threeBody.facet_counts.facet_pivot[
      "state_province,county,genus"
    ] as unknown as PivotEntry[];

    for (const stateEntry of twoLevel) {
      const matchingThreeState = threeLevel.find(
        (e) => e.value === stateEntry.value,
      );
      expect(matchingThreeState).toBeDefined();
      const threeCounties = (matchingThreeState?.pivot ?? []).map(
        (c) => c.value,
      );
      for (const countyEntry of stateEntry.pivot ?? []) {
        expect(threeCounties).toContain(countyEntry.value);
      }
    }
  });

  it("GET state_province,county pivot includes a county name that appears in multiple states", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,234)&facet%28%28pivot%2C%28state_province%2Ccounty%29%29%2C%28mincount%2C1%29%29",
      }),
      ctx(["bvbrc-website", "genome"]),
    );
    const body = (await resp.json()) as SolrFacetBody;
    interface PivotEntry {
      value: string;
      pivot?: PivotEntry[];
    }
    const pivot: PivotEntry[] = body.facet_counts.facet_pivot[
      "state_province,county"
    ] as unknown as PivotEntry[];

    const countyToStates = new Map<string, string[]>();
    for (const stateEntry of pivot) {
      for (const countyEntry of stateEntry.pivot ?? []) {
        const states = countyToStates.get(countyEntry.value) ?? [];
        states.push(stateEntry.value);
        countyToStates.set(countyEntry.value, states);
      }
    }

    const crossStateCounty = Array.from(countyToStates.entries()).find(
      ([, states]) => states.length > 1,
    );
    expect(crossStateCounty).toBeDefined();
  });

  it("GET returns 400 for unhandled bvbrc-website/genome queries", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome/?eq(taxon_lineage_ids,2)&limit(0)",
      }),
      ctx(["bvbrc-website", "genome"]),
    );

    expect(resp.status).toBe(400);
    expect((await resp.json()) as unknown).toMatchObject({
      error: expect.stringContaining(
        "unhandled bvbrc-website/genome query",
      ) as unknown,
    });
  });

  it("GET serves bacteria taxonomy fixture with lineage_ids", async () => {
    const resp = await GET(
      mockNextRequest({
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/taxonomy/2",
      }),
      ctx(["bvbrc-website", "taxonomy", "2"]),
    );

    expect(resp.status).toBe(200);
    expect((await resp.json()) as unknown).toMatchObject({
      taxon_id: 2,
      taxon_name: "Bacteria",
      lineage_ids: [131567, 2],
    });
  });

  it.each([
    ["10239", "Viruses", [10239]],
    ["131567", "cellular organisms", [131567]],
  ])(
    "GET serves landing root taxonomy fixture %s",
    async (taxonId, taxonName, lineageIds) => {
      const resp = await GET(
        mockNextRequest({
          url: `http://localhost:3020/api/e2e-mock/bvbrc-website/taxonomy/${taxonId}`,
        }),
        ctx(["bvbrc-website", "taxonomy", taxonId]),
      );

      expect(resp.status).toBe(200);
      expect((await resp.json()) as unknown).toMatchObject({
        taxon_id: Number(taxonId),
        taxon_name: taxonName,
        lineage_ids: lineageIds,
      });
    },
  );

  it("POST returns 400 for endpoints outside the allowlisted namespaces", async () => {
    const resp = await POST(
      mockNextRequest({
        method: "POST",
        body: { something: 1 },
        url: "http://localhost:3020/api/e2e-mock/mystery-endpoint",
      }),
      ctx(["mystery-endpoint"]),
    );

    expect(resp.status).toBe(400);
    expect((await resp.json()) as unknown).toMatchObject({
      error: expect.stringContaining("unhandled POST endpoint") as unknown,
      path: "mystery-endpoint",
    });
  });

  it("POST returns SOLR-shaped genome_amr fixture for a well-formed AMR body", async () => {
    const body =
      "eq(genome_id,*)" +
      "&genome(eq(taxon_lineage_ids,234))" +
      "&in(resistant_phenotype,(Resistant,Susceptible,Intermediate))" +
      "&limit(1)" +
      "&facet((pivot,(antibiotic,resistant_phenotype)),(mincount,1),(limit,-1))" +
      "&json(nl,map)";

    const resp = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome_amr/",
        headers: {
          "Content-Type": "application/rqlquery+x-www-form-urlencoded",
        },
        rawBody: body,
      }),
      ctx(["bvbrc-website", "genome_amr"]),
    );

    expect(resp.status).toBe(200);
    const payload = (await resp.json()) as SolrFacetBody;
    const pivot =
      payload.facet_counts.facet_pivot["antibiotic,resistant_phenotype"];
    expect(Array.isArray(pivot)).toBe(true);
    expect(pivot[0]).toMatchObject({
      field: "antibiotic",
      value: expect.any(String) as unknown,
      pivot: expect.arrayContaining([
        expect.objectContaining({
          field: "resistant_phenotype",
          value: "Resistant",
        }),
      ]) as unknown,
    });
  });

  it("POST returns 400 when genome_amr body is missing the antibiotic pivot fragment", async () => {
    // Body has the lineage and phenotype clauses but lacks the required
    // facet((pivot,(antibiotic,resistant_phenotype)) fragment — a real caller typo.
    const body =
      "eq(genome_id,*)" +
      "&genome(eq(taxon_lineage_ids,234))" +
      "&in(resistant_phenotype,(Resistant,Susceptible,Intermediate))" +
      "&facet((field,antibiotic))" +
      "&limit(1)";

    const resp = await POST(
      mockNextRequest({
        method: "POST",
        url: "http://localhost:3020/api/e2e-mock/bvbrc-website/genome_amr/",
        headers: {
          "Content-Type": "application/rqlquery+x-www-form-urlencoded",
        },
        rawBody: body,
      }),
      ctx(["bvbrc-website", "genome_amr"]),
    );

    expect(resp.status).toBe(400);
    expect((await resp.json()) as unknown).toMatchObject({
      error: expect.stringContaining(
        "invalid bvbrc-website/genome_amr POST",
      ) as unknown,
      reason: expect.stringContaining(
        "facet((pivot,(antibiotic,resistant_phenotype))",
      ) as unknown,
    });
  });
});
