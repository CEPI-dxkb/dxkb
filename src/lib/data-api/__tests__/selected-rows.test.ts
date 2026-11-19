import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";

import { DataRepository } from "../client";
import { fetchSelectedRows } from "../selected-rows";

interface SelectedBody {
  operation: string;
  ids: string[];
  fields?: string[];
}

/** Answers each `selected` POST with its ids in reverse, so the result order is the function's own. */
function serveSelected() {
  const bodies: SelectedBody[] = [];
  server.use(
    http.post("/api/data/ppi", async ({ request }) => {
      const body = (await request.json()) as SelectedBody;
      bodies.push(body);
      return HttpResponse.json({
        rows: [...body.ids].reverse().map((id) => ({ id, evidence: "x" })),
      });
    }),
  );
  return bodies;
}

describe("fetchSelectedRows", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_DATA_API;
  });

  it("reads the ids in batches of 500 through the selected operation", async () => {
    const bodies = serveSelected();
    const ids = Array.from({ length: 1_200 }, (_, index) => `ppi-${String(index)}`);

    const rows = await fetchSelectedRows(
      new DataRepository(),
      "ppi",
      "id",
      ids,
      ["id", "evidence"],
    );

    expect(bodies.map((body) => body.operation)).toStrictEqual([
      "selected",
      "selected",
      "selected",
    ]);
    expect(bodies.map((body) => body.ids.length).sort()).toStrictEqual([
      200, 500, 500,
    ]);
    expect(bodies.flatMap((body) => body.ids).sort()).toStrictEqual(
      [...ids].sort(),
    );
    expect(rows.map((row) => row.id)).toStrictEqual(ids);
  });

  it("waits out a rate limit on one batch and keeps the rows of the others", async () => {
    let refused = false;
    const bodies: SelectedBody[] = [];
    server.use(
      http.post("/api/data/ppi", async ({ request }) => {
        const body = (await request.json()) as SelectedBody;
        bodies.push(body);
        if (body.ids[0] === "ppi-500" && !refused) {
          refused = true;
          return HttpResponse.json(
            { error: "Too many requests.", code: "rate_limited" },
            { status: 429, headers: { "Retry-After": "0" } },
          );
        }
        return HttpResponse.json({
          rows: body.ids.map((id) => ({ id, evidence: "x" })),
        });
      }),
    );
    const ids = Array.from({ length: 1_200 }, (_, index) => `ppi-${String(index)}`);

    const rows = await fetchSelectedRows(
      new DataRepository(),
      "ppi",
      "id",
      ids,
      ["id", "evidence"],
    );

    // Three batches, and the refused one is sent again.
    expect(bodies).toHaveLength(4);
    expect(rows.map((row) => row.id)).toStrictEqual(ids);
  });

  it("adds the id field to the requested fields when it is missing", async () => {
    const bodies = serveSelected();

    await fetchSelectedRows(new DataRepository(), "ppi", "id", ["ppi-1"], [
      "evidence",
    ]);

    expect(bodies[0]?.fields).toStrictEqual(["evidence", "id"]);
  });

  it("keeps the requested fields as given when they name the id field", async () => {
    const bodies = serveSelected();

    await fetchSelectedRows(new DataRepository(), "ppi", "id", ["ppi-1"], [
      "id",
      "evidence",
    ]);

    expect(bodies[0]?.fields).toStrictEqual(["id", "evidence"]);
  });
});
