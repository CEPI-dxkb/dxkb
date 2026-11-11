import { http, HttpResponse, type JsonBodyType } from "msw";

import {
  fetchReferenceGenomes,
  inlineReferenceGenomeLimit,
} from "@/lib/services/organisms/reference-genomes";
import { server } from "@/test-helpers/msw-server";

const baseUrl = "https://bvbrc.test/api-for-website";

beforeEach(() => {
  process.env.BVBRC_WEBSITE_API_URL = baseUrl;
});

afterEach(() => {
  delete process.env.BVBRC_WEBSITE_API_URL;
});

const doc = {
  reference_genome: "Reference",
  genome_name: "Escherichia coli K-12",
  genome_id: "511145.12",
};
const repDoc = {
  reference_genome: "Representative",
  genome_name: "Escherichia coli B",
  genome_id: "481805.6",
};

function facet(...pairs: (string | number)[]) {
  return { facet_counts: { facet_fields: { reference_genome: pairs } } };
}

function serveTypes(
  summary: JsonBodyType,
  byType: Record<string, JsonBodyType>,
  requested: string[] = [],
) {
  server.use(
    http.get(`${baseUrl}/genome/`, ({ request }) => {
      const query = decodeURIComponent(request.url.split("?")[1]);
      requested.push(query);
      const type = /eq\(reference_genome,([^*)][^)]*)\)/.exec(query)?.[1];
      return HttpResponse.json(type ? byType[type] : summary);
    }),
  );
}

describe("fetchReferenceGenomes", () => {
  it("reads the facet once, then one capped read per type", async () => {
    const requested: string[] = [];
    serveTypes(
      {
        response: { numFound: 21344, docs: [] },
        ...facet("Reference", 15, "Representative", 21329),
      },
      {
        Reference: { response: { numFound: 15, docs: [doc] } },
        Representative: { response: { numFound: 21329, docs: [repDoc] } },
      },
      requested,
    );

    await fetchReferenceGenomes(2);

    expect(inlineReferenceGenomeLimit).toBe(1000);
    expect(requested).toHaveLength(3);
    const [summary, ...types] = requested.map((query) => query.split("&"));
    const lineageScope =
      "and(eq(taxon_lineage_ids,2),ne(genome_status,Deprecated))";
    expect(summary).toEqual(
      expect.arrayContaining([
        lineageScope,
        "eq(reference_genome,*)",
        "facet((field,reference_genome),(mincount,1))",
      ]),
    );
    for (const [index, type] of ["Reference", "Representative"].entries()) {
      const clauses = types.find((c) =>
        c.includes(`eq(reference_genome,${type})`),
      );
      expect(clauses, `read ${String(index)}`).toEqual(
        expect.arrayContaining([
          lineageScope,
          `eq(reference_genome,${type})`,
          "select(reference_genome,genome_name,genome_id)",
          "sort(+genome_name)",
          "limit(1000)",
        ]),
      );
    }
    expect(requested.join("\n")).not.toContain("json(nl,map)");
  });

  it("scopes every read to a Genome list's own query", async () => {
    const requested: string[] = [];
    serveTypes(
      {
        response: { numFound: 2, docs: [] },
        ...facet("Reference", 1, "Representative", 1),
      },
      {
        Reference: { response: { numFound: 1, docs: [doc] } },
        Representative: { response: { numFound: 1, docs: [repDoc] } },
      },
      requested,
    );

    await fetchReferenceGenomes({
      fieldRql: "eq(genus,Escherichia)",
      keywordRql: "keyword(coli)",
    });

    expect(requested).toHaveLength(3);
    for (const query of requested) {
      expect(query.split("&")).toContain(
        "and(eq(genus,Escherichia),keyword(coli))",
      );
    }
  });

  it("percent-encodes a facet value in its per-type read", async () => {
    const rawQueries: string[] = [];
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const query = new URL(request.url).search.slice(1);
        rawQueries.push(query);
        return HttpResponse.json(
          query.includes("eq(reference_genome,*)")
            ? { response: { numFound: 1, docs: [] }, ...facet("A&B (x)", 1) }
            : { response: { numFound: 1, docs: [] } },
        );
      }),
    );

    await fetchReferenceGenomes(2);

    const typeRead = rawQueries.find((query) => !query.includes(",*)"));
    expect(typeRead?.split("&")).toEqual(
      expect.arrayContaining(["eq(reference_genome,A%26B%20%28x%29)"]),
    );
  });

  it("sends the Solr Accept header", async () => {
    const accepts: (string | null)[] = [];
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        accepts.push(request.headers.get("accept"));
        return HttpResponse.json({
          response: { numFound: 0, docs: [] },
          ...facet(),
        });
      }),
    );

    await fetchReferenceGenomes(562);

    expect(accepts).toEqual(["application/solr+json"]);
  });

  it("merges the rows, and reports the counts and the total", async () => {
    serveTypes(
      {
        response: { numFound: 24911, docs: [] },
        ...facet("Reference", 24890, "Representative", 21),
      },
      {
        Reference: { response: { numFound: 24890, docs: [doc] } },
        Representative: { response: { numFound: 21, docs: [repDoc] } },
      },
    );

    await expect(fetchReferenceGenomes(10239)).resolves.toEqual({
      rows: [doc, repDoc],
      counts: { Reference: 24890, Representative: 21 },
      total: 24911,
    });
  });

  it("reads nothing more when no genome has a type", async () => {
    const requested: string[] = [];
    serveTypes({ response: { numFound: 0, docs: [] }, ...facet() }, {}, requested);

    await expect(fetchReferenceGenomes(562)).resolves.toEqual({
      rows: [],
      counts: {},
      total: 0,
    });
    expect(requested).toHaveLength(1);
  });

  it("says what is wrong with a payload without a response object", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () => HttpResponse.json({ docs: [] })),
    );

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(
      /^Unexpected BV-BRC response shape: expected a response object$/,
    );
  });

  it("says what is wrong with docs that are not a list", async () => {
    serveTypes(
      { response: { numFound: 1, docs: [] }, ...facet("Reference", 1) },
      { Reference: { response: { numFound: 1, docs: {} } } },
    );

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(
      /^Unexpected BV-BRC response shape: expected an array of genomes$/,
    );
  });

  it("says which genome is not an object", async () => {
    serveTypes(
      { response: { numFound: 1, docs: [] }, ...facet("Reference", 1) },
      { Reference: { response: { numFound: 1, docs: [null] } } },
    );

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(
      /^Unexpected BV-BRC response shape: genome 0 is not an object$/,
    );
  });

  it("surfaces the original error when one type's read fails", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, ({ request }) => {
        const query = decodeURIComponent(request.url);
        if (query.includes("eq(reference_genome,Representative)")) {
          return HttpResponse.json(
            { error: "Solr is down" },
            { status: 500 },
          );
        }
        if (query.includes("eq(reference_genome,Reference)")) {
          return HttpResponse.json({ response: { numFound: 1, docs: [doc] } });
        }
        return HttpResponse.json({
          response: { numFound: 2, docs: [] },
          ...facet("Reference", 1, "Representative", 1),
        });
      }),
    );

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(/Solr is down/);
  });

  it("throws when the facet counts are missing", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({ response: { numFound: 1, docs: [doc] } }),
      ),
    );

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(
      /^Unexpected SOLR response shape: missing facet_counts$/,
    );
  });

  it("throws when numFound is missing", async () => {
    server.use(
      http.get(`${baseUrl}/genome/`, () =>
        HttpResponse.json({ response: { docs: [] }, ...facet("Reference", 1) }),
      ),
    );

    await expect(fetchReferenceGenomes(562)).rejects.toThrow(
      /^Unexpected BV-BRC response shape: numFound is missing$/,
    );
  });
});
