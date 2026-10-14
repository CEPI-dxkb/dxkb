import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { DataRepository, DataRepositoryError } from "../client";
import { maxFastaIds } from "../fasta";
import { maxRequestBytes } from "../validation";

// Its own file because `client.test.ts` replaces `global.fetch` and restores
// the pre-MSW original after each case, which would leave these requests
// unintercepted.
// MSW rather than a `fetch` stub, because what matters is the request each batch puts
// on the wire and how the bodies are joined.
describe("DataRepository.fasta", () => {
  function captureFasta(respond: (ids: string[]) => Response) {
    const bodies: { type: string; ids: string[] }[] = [];
    server.use(
      http.post("*/api/data/genome_feature/fasta", async ({ request }) => {
        const body = (await request.json()) as { type: string; ids: string[] };
        bodies.push(body);
        return respond(body.ids);
      }),
    );
    return bodies;
  }

  it("POSTs the type and ids to the resource's FASTA route and returns a FASTA blob", async () => {
    const bodies = captureFasta(() => new Response(">a\nACGT\n"));

    const blob = await new DataRepository().fasta("genome_feature", {
      type: "dna",
      ids: ["PATRIC.1"],
    });

    expect(bodies).toEqual([{ type: "dna", ids: ["PATRIC.1"] }]);
    expect(blob.type).toBe("text/x-fasta");
    expect(await blob.text()).toBe(">a\nACGT\n");
  });

  it("splits a long id list into capped batches and joins them record-aligned", async () => {
    // The first part lacks a trailing newline: joined naively, its last
    // sequence line would run into the second part's `>` header.
    const bodies = captureFasta((ids) =>
      new Response(ids[0] === "0" ? ">first\nACGT" : ">second\nTTTT\n"),
    );
    const ids = Array.from({ length: maxFastaIds + 1 }, (_, index) =>
      String(index),
    );

    const blob = await new DataRepository().fasta("genome_feature", {
      type: "dna",
      ids,
    });

    expect(bodies.map((body) => body.ids.length)).toEqual([maxFastaIds, 1]);
    expect(bodies[1].ids).toEqual([String(maxFastaIds)]);
    expect(await blob.text()).toBe(">first\nACGT\n>second\nTTTT\n");
  });

  it("requests an id once even when its repeats would fall in different batches", async () => {
    const bodies = captureFasta((ids) => new Response(`>${ids[0]}\nACGT\n`));
    const unique = Array.from({ length: maxFastaIds + 1 }, (_, index) =>
      String(index),
    );

    await new DataRepository().fasta("genome_feature", {
      type: "dna",
      ids: [...unique, "0", String(maxFastaIds)],
    });

    expect(bodies.flatMap((body) => body.ids)).toEqual(unique);
  });

  it("keeps each batch under the route's body cap when ids are long", async () => {
    const sizes: number[] = [];
    const bodies: string[][] = [];
    server.use(
      http.post("*/api/data/genome_feature/fasta", async ({ request }) => {
        const text = await request.text();
        sizes.push(new TextEncoder().encode(text).length);
        bodies.push((JSON.parse(text) as { ids: string[] }).ids);
        return new Response(">a\nACGT\n");
      }),
    );
    // Real feature ids run to 60-odd characters; at 500 per request these
    // serialize past the cap.
    const ids = Array.from(
      { length: maxFastaIds },
      (_, index) =>
        `PATRIC.2993654.5.NZ_JAEUGC010000001.CDS.${String(10_000_000 + index)}.10862867.rev`,
    );
    expect(JSON.stringify({ type: "dna", ids }).length).toBeGreaterThan(
      maxRequestBytes,
    );

    await new DataRepository().fasta("genome_feature", { type: "dna", ids });

    expect(bodies.length).toBeGreaterThan(1);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(maxRequestBytes);
    expect(bodies.flat()).toEqual(ids);
  });

  it("waits out the route's rate limit and resumes with the batch it refused", async () => {
    let refused = false;
    const bodies = captureFasta((ids) => {
      if (ids[0] === String(maxFastaIds) && !refused) {
        refused = true;
        return HttpResponse.json(
          { error: "Too many sequence downloads.", code: "rate_limited" },
          { status: 429, headers: { "Retry-After": "0" } },
        );
      }
      return new Response(`>${ids[0]}\nACGT\n`);
    });
    const ids = Array.from({ length: maxFastaIds + 1 }, (_, index) =>
      String(index),
    );

    const blob = await new DataRepository().fasta("genome_feature", {
      type: "dna",
      ids,
    });

    expect(bodies.map((body) => body.ids[0])).toEqual([
      "0",
      String(maxFastaIds),
      String(maxFastaIds),
    ]);
    expect(await blob.text()).toBe(`>0\nACGT\n>${String(maxFastaIds)}\nACGT\n`);
  });

  it("returns an empty blob when nothing matched", async () => {
    captureFasta(() => new Response(""));

    const blob = await new DataRepository().fasta("genome_feature", {
      type: "protein",
      ids: ["missing"],
    });

    expect(blob.size).toBe(0);
  });

  it("surfaces the route's own error message and code", async () => {
    captureFasta(() =>
      HttpResponse.json(
        {
          error: "FASTA downloads are limited to 500 records per request.",
          code: "invalid_request",
        },
        { status: 400 },
      ),
    );

    await expect(
      new DataRepository().fasta("genome_feature", {
        type: "dna",
        ids: ["PATRIC.1"],
      }),
    ).rejects.toEqual(
      new DataRepositoryError(
        "FASTA downloads are limited to 500 records per request.",
        400,
        "invalid_request",
      ),
    );
  });
});
