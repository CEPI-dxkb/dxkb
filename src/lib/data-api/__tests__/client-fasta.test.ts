import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { DataRepository, DataRepositoryError } from "../client";
import { maxFastaIds } from "../fasta";

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
