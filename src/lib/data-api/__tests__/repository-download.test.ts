import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import type { DownloadRequest } from "../downloads";
import { DataApiError, ServerDataRepository } from "../repository";
import { DataApiValidationError } from "../resources";
import { keywordClauses } from "../rql";

const baseUrl = "https://data.test";

interface SeenRequest {
  method: string;
  url: URL;
  accept: string | null;
  authorization: string | null;
  contentType: string | null;
  range: string | null;
  body: string;
}

/** Records every upstream request to `resource` and answers with `respond`. */
function captureUpstream(
  resource: string,
  respond: (request: SeenRequest) => Response = () => new Response("file"),
  method: "post" | "get" = "post",
) {
  const seen: SeenRequest[] = [];
  server.use(
    http[method](`${baseUrl}/${resource}/`, async ({ request }) => {
      const entry = {
        method: request.method,
        url: new URL(request.url),
        accept: request.headers.get("Accept"),
        authorization: request.headers.get("Authorization"),
        contentType: request.headers.get("Content-Type"),
        range: request.headers.get("Range"),
        body: await request.text(),
      };
      seen.push(entry);
      return respond(entry);
    }),
  );
  return seen;
}

/** The gateway's fresh count of a query download (`application/solr+json`). */
function solrCount(numFound: number): Response {
  return HttpResponse.json({ response: { numFound, docs: [] } });
}

/** Answers `resource`'s count reads with `numFound`, and records them. */
function countUpstream(resource: string, numFound: number) {
  return captureUpstream(resource, () => solrCount(numFound), "get");
}

function request(overrides: Partial<DownloadRequest> = {}): DownloadRequest {
  return {
    format: "tsv",
    scope: { kind: "selected", ids: ["PATRIC.1", "PATRIC.2"] },
    fileNameBase: "genome_feature",
    total: 2,
    ...overrides,
  };
}

async function text(stream: ReadableStream<Uint8Array> | null) {
  return new Response(stream).text();
}

describe("ServerDataRepository.download", () => {
  const repository = () => new ServerDataRepository({ baseUrl });

  it("POSTs a selection as one in() query and returns the upstream body unread", async () => {
    const seen = captureUpstream("genome_feature", () => new Response("a\tb\n"));

    const body = await repository().download("genome_feature", request());

    expect(await text(body)).toBe("a\tb\n");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({
      method: "POST",
      accept: "text/tsv",
      authorization: null,
      contentType: "application/rqlquery+x-www-form-urlencoded",
      range: "items=0-2",
      // No trailing newline: the upstream rejects one.
      body: "in(feature_id,(PATRIC.1,PATRIC.2))&sort(+feature_id)&limit(2)",
    });
    expect(seen[0].url.search).toBe("");
  });

  it.each([
    ["csv", "text/csv"],
    ["xlsx", "application/vnd.openxmlformats"],
    ["dna-fasta", "application/dna+fasta"],
    ["protein-fasta", "application/protein+fasta"],
  ] as const)("asks for %s with Accept %s", async (format, accept) => {
    const seen = captureUpstream("genome_feature");

    await repository().download("genome_feature", request({ format }));

    expect(seen[0].accept).toBe(accept);
  });

  it("sends a query's predicate, the table sort then the primary key, and legacy's limit", async () => {
    countUpstream("genome", 401);
    const seen = captureUpstream("genome");

    await repository().download("genome", {
      format: "csv",
      scope: { kind: "query", rql: "eq(genome_status,Complete)" },
      sort: { field: "genome_length", direction: "desc" },
      fileNameBase: "genome",
      total: 401,
    });

    expect(seen[0].body).toBe(
      "eq(genome_status,Complete)&sort(-genome_length,+genome_id)&limit(2500000)",
    );
    expect(seen[0].range).toBe("items=0-2500000");
  });

  it("sends every key of a multi-key sort before the primary key", async () => {
    countUpstream("genome_feature", 3);
    const seen = captureUpstream("genome_feature");

    await repository().download("genome_feature", {
      format: "csv",
      scope: { kind: "query", rql: "eq(genome_id,83332.12)" },
      sort: {
        field: "genome_name",
        direction: "asc",
        then: [
          { field: "accession", direction: "asc" },
          { field: "start", direction: "asc" },
        ],
      },
      fileNameBase: "genome_feature",
      total: 3,
    });

    expect(seen[0].body).toBe(
      "eq(genome_id,83332.12)&sort(+genome_name,+accession,+start,+feature_id)&limit(2500000)",
    );
  });

  it("counts a query again before downloading it", async () => {
    const counts = countUpstream("genome", 401);
    captureUpstream("genome");

    await repository().download("genome", {
      format: "csv",
      scope: {
        kind: "query",
        rql: "eq(genome_status,Complete)",
        keyword: "coli",
        keywordMode: "exact",
      },
      fileNameBase: "genome",
      total: 401,
    });

    const [keyword] = keywordClauses("coli", "exact");
    expect(counts).toHaveLength(1);
    expect(counts[0]).toMatchObject({
      accept: "application/solr+json",
      range: "items=0-1",
    });
    expect(decodeURIComponent(counts[0].url.search)).toBe(
      `?and(eq(genome_status,Complete),${keyword})&select(genome_id)`,
    );
  });

  it("does not stop at a total that went stale after the table loaded", async () => {
    // The table counted 2 rows; 3 match by the time of the download.
    countUpstream("genome", 3);
    const seen = captureUpstream("genome", () => new Response("a\nb\nc\n"));

    const body = await repository().download("genome", {
      format: "tsv",
      scope: { kind: "query" },
      fileNameBase: "genome",
      total: 2,
    });

    expect(await text(body)).toBe("a\nb\nc\n");
    expect(seen[0].body).toBe("eq(genome_id,*)&sort(+genome_id)&limit(2500000)");
  });

  it.each([
    ["xlsx", "genome", 1_048_575],
    ["protein-fasta", "genome_feature", 10_000],
    ["dna-fasta", "genome_feature", 10_000],
  ] as const)(
    "asks for at most a %s file's cap",
    async (format, resource, limit) => {
      countUpstream(resource, 5);
      const seen = captureUpstream(resource);

      await repository().download(resource, {
        format,
        scope: { kind: "query" },
        fileNameBase: resource,
        total: 5,
      });

      expect(seen[0].body).toMatch(new RegExp(`&limit\\(${String(limit)}\\)$`));
    },
  );

  it("refuses a query that has grown past a cap since the table counted it", async () => {
    countUpstream("genome", 1_048_576);
    const seen = captureUpstream("genome");

    const error: unknown = await repository()
      .download("genome", {
        format: "xlsx",
        scope: { kind: "query" },
        fileNameBase: "genome",
        total: 1_048_575,
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DataApiValidationError);
    expect(error).toMatchObject({
      message:
        "Over Excel's 1,048,576-row limit (the query now matches 1,048,576 rows).",
    });
    expect(seen).toHaveLength(0);
  });

  it("reports a query that no longer matches anything instead of an empty file", async () => {
    countUpstream("genome", 0);
    const seen = captureUpstream("genome");

    await expect(
      repository().download("genome", {
        format: "csv",
        scope: { kind: "query" },
        fileNameBase: "genome",
        total: 4,
      }),
    ).rejects.toMatchObject({
      message: "No records matched the download.",
      status: 404,
    });
    expect(seen).toHaveLength(0);
  });

  it("never counts a selection", async () => {
    const counts = countUpstream("genome_feature", 0);
    captureUpstream("genome_feature");

    await repository().download("genome_feature", request());

    expect(counts).toHaveLength(0);
  });

  it("combines the rql with the keyword the way the table query does", async () => {
    countUpstream("genome", 5);
    const seen = captureUpstream("genome");

    await repository().download("genome", {
      format: "tsv",
      scope: {
        kind: "query",
        rql: "eq(genome_status,Complete)",
        keyword: "coli",
        keywordMode: "exact",
      },
      fileNameBase: "genome",
      total: 5,
    });

    const [keyword] = keywordClauses("coli", "exact");
    expect(seen[0].body).toBe(
      `and(eq(genome_status,Complete),${keyword})&sort(+genome_id)&limit(2500000)`,
    );
  });

  it("matches every row when the query has no predicate", async () => {
    countUpstream("genome", 7);
    const seen = captureUpstream("genome");

    await repository().download("genome", {
      format: "tsv",
      scope: { kind: "query" },
      fileNameBase: "genome",
      total: 7,
    });

    expect(seen[0].body).toBe("eq(genome_id,*)&sort(+genome_id)&limit(2500000)");
  });

  it("selects only the visible columns, and every field without them", async () => {
    const seen = captureUpstream("genome_feature");

    await repository().download(
      "genome_feature",
      request({ fields: ["patric_id", "product"] }),
    );
    await repository().download("genome_feature", request());

    expect(seen[0].body).toBe(
      "in(feature_id,(PATRIC.1,PATRIC.2))&select(patric_id,product)&sort(+feature_id)&limit(2)",
    );
    expect(seen[1].body).not.toContain("select(");
  });

  it("never projects a sequence file", async () => {
    const seen = captureUpstream("genome_feature");

    await repository().download(
      "genome_feature",
      request({ format: "protein-fasta", fields: ["patric_id"] }),
    );

    expect(seen[0].body).toBe(
      "in(feature_id,(PATRIC.1,PATRIC.2))&sort(+feature_id)&limit(2)",
    );
  });

  it("downloads a genome selection's DNA as the contigs of each genome", async () => {
    const seen = captureUpstream("genome_sequence", () => new Response(">c\nACGT\n"));

    const body = await repository().download("genome", {
      format: "dna-fasta",
      scope: { kind: "selected", ids: ["388040.3", "388040.4"] },
      sort: { field: "genome_name", direction: "asc" },
      fileNameBase: "genome",
      total: 2,
    });

    expect(await text(body)).toBe(">c\nACGT\n");
    expect(seen[0]).toMatchObject({
      accept: "application/dna+fasta",
      body: "in(genome_id,(388040.3,388040.4))&sort(+sequence_id)&limit(2500000)",
    });
  });

  it("reads a genome query's ids first, then downloads their contigs", async () => {
    const genomes = captureUpstream(
      "genome",
      ({ accept }) =>
        accept === "application/solr+json"
          ? solrCount(2)
          : HttpResponse.json([{ genome_id: "1.1" }, { genome_id: "1.2" }]),
      "get",
    );
    const contigs = captureUpstream("genome_sequence");

    await repository().download("genome", {
      format: "dna-fasta",
      scope: { kind: "query", rql: "eq(genus,Brucella)" },
      sort: { field: "genome_name", direction: "asc" },
      fileNameBase: "genome",
      total: 2,
    });

    // genomes[0] is the count.
    expect(decodeURIComponent(genomes[1].url.search)).toBe(
      "?eq(genus,Brucella)&select(genome_id)&sort(+genome_name,+genome_id)",
    );
    // One id past the cap, to see a query that grew after its count.
    expect(genomes[1].range).toBe("items=0-10001");
    expect(contigs[0].body).toBe(
      "in(genome_id,(1.1,1.2))&sort(+sequence_id)&limit(2500000)",
    );
  });

  it("refuses a genome query whose ids outgrew the sequence cap after the count", async () => {
    captureUpstream(
      "genome",
      ({ accept }) =>
        accept === "application/solr+json"
          ? solrCount(10_000)
          : HttpResponse.json(
              Array.from({ length: 10_001 }, (_, index) => ({
                genome_id: `1.${String(index)}`,
              })),
            ),
      "get",
    );
    const contigs = captureUpstream("genome_sequence");

    const error = await repository()
      .download("genome", {
        format: "dna-fasta",
        scope: { kind: "query", rql: "eq(genus,Brucella)" },
        fileNameBase: "genome",
        total: 10_000,
      })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DataApiValidationError);
    expect(error).toMatchObject({
      message:
        "Sequences: 10,000 rows at most (the query now matches more than 10,000 rows).",
    });
    expect(contigs).toHaveLength(0);
  });

  it("reports a genome query that matched nothing instead of sending an empty in()", async () => {
    // Counted 2, but the ids read after it came back empty.
    captureUpstream(
      "genome",
      ({ accept }) =>
        accept === "application/solr+json"
          ? solrCount(2)
          : HttpResponse.json([]),
      "get",
    );
    const contigs = captureUpstream("genome_sequence");

    await expect(
      repository().download("genome", {
        format: "dna-fasta",
        scope: { kind: "query" },
        fileNameBase: "genome",
        total: 2,
      }),
    ).rejects.toMatchObject({
      message: "No records matched the download.",
      status: 404,
    });
    expect(contigs).toHaveLength(0);
  });

  it.each([
    ["tsv", "No records matched the download."],
    ["protein-fasta", "No protein sequence is available for the requested records."],
  ] as const)(
    "answers an empty %s body as a 404, never as an empty file",
    async (format, message) => {
      captureUpstream("genome_feature", () => new Response(""));

      await expect(
        repository().download("genome_feature", request({ format })),
      ).rejects.toMatchObject({ message, status: 404, code: "not_found" });
    },
  );

  it("passes every chunk of a non-empty body through unchanged", async () => {
    const encoder = new TextEncoder();
    captureUpstream(
      "genome_feature",
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array());
              controller.enqueue(encoder.encode(">a\nAC"));
              controller.enqueue(encoder.encode("GT\n>b\nTT\n"));
              controller.close();
            },
          }),
        ),
    );

    const body = await repository().download(
      "genome_feature",
      request({ format: "dna-fasta" }),
    );

    expect(await text(body)).toBe(">a\nACGT\n>b\nTT\n");
  });

  it("sends the session token, and only over HTTPS", async () => {
    const seen = captureUpstream("genome_feature");

    await new ServerDataRepository({ baseUrl, token: "secret" }).download(
      "genome_feature",
      request(),
    );
    expect(seen[0].authorization).toBe("secret");

    await expect(
      new ServerDataRepository({
        baseUrl: "http://data.test",
        token: "secret",
      }).download("genome_feature", request()),
    ).rejects.toThrow("Authenticated data service requests require HTTPS.");
  });

  it("keeps the upstream's own error message", async () => {
    captureUpstream("genome_feature", () =>
      HttpResponse.json(
        { error: "Illegal character in query string" },
        { status: 400 },
      ),
    );

    const error: unknown = await repository()
      .download("genome_feature", request())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DataApiError);
    expect(error).toMatchObject({
      message: "Illegal character in query string",
      status: 502,
      code: "upstream_error",
    });
  });
});
