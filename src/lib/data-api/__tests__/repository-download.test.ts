import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import type { DownloadRequest } from "../downloads";
import { DataApiError, ServerDataRepository } from "../repository";
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

  it("sends a query's predicate, the table sort then the primary key, and its total", async () => {
    const seen = captureUpstream("genome");

    await repository().download("genome", {
      format: "csv",
      scope: { kind: "query", rql: "eq(genome_status,Complete)" },
      sort: { field: "genome_length", direction: "desc" },
      fileNameBase: "genome",
      total: 401,
    });

    expect(seen[0].body).toBe(
      "eq(genome_status,Complete)&sort(-genome_length,+genome_id)&limit(401)",
    );
    expect(seen[0].range).toBe("items=0-401");
  });

  it("combines the rql with the keyword the way the table query does", async () => {
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
      `and(eq(genome_status,Complete),${keyword})&sort(+genome_id)&limit(5)`,
    );
  });

  it("matches every row when the query has no predicate", async () => {
    const seen = captureUpstream("genome");

    await repository().download("genome", {
      format: "tsv",
      scope: { kind: "query" },
      fileNameBase: "genome",
      total: 7,
    });

    expect(seen[0].body).toBe("eq(genome_id,*)&sort(+genome_id)&limit(7)");
  });

  it("selects the visible columns plus the id, and every field without them", async () => {
    const seen = captureUpstream("genome_feature");

    await repository().download(
      "genome_feature",
      request({ fields: ["patric_id", "product"] }),
    );
    await repository().download("genome_feature", request());

    expect(seen[0].body).toBe(
      "in(feature_id,(PATRIC.1,PATRIC.2))&select(patric_id,product,feature_id)&sort(+feature_id)&limit(2)",
    );
    expect(seen[1].body).not.toContain("select(");
  });

  it("downloads every field when a column name cannot go in a select()", async () => {
    const seen = captureUpstream("genome_feature");

    await repository().download(
      "genome_feature",
      request({ fields: ["patric_id", "1_pb2"] }),
    );

    expect(seen[0].body).not.toContain("select(");
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
      () =>
        HttpResponse.json([{ genome_id: "1.1" }, { genome_id: "1.2" }]),
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

    expect(decodeURIComponent(genomes[0].url.search)).toBe(
      "?eq(genus,Brucella)&select(genome_id)&sort(+genome_name,+genome_id)",
    );
    expect(genomes[0].range).toBe("items=0-2");
    expect(contigs[0].body).toBe(
      "in(genome_id,(1.1,1.2))&sort(+sequence_id)&limit(2500000)",
    );
  });

  it("reports a genome query that matched nothing instead of sending an empty in()", async () => {
    captureUpstream("genome", () => HttpResponse.json([]), "get");
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
