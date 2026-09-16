/**
 * GenomeDetailPanel's cache-miss read. The row normally arrives in the query
 * cache from the page `ListData` already loaded; when it does not, the panel
 * reads the member through the same-origin Data API gateway.
 *
 * MSW intercepts the gateway call, so the real request/response path runs.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import { GenomeDetailPanel } from "../genome-detail-panel";

function renderPanel(id: string) {
  return render(
    <GenomeDetailPanel
      genomeId={id}
      resource="genome_sequence"
      selectedIds={[id]}
    />,
    { wrapper: createQueryClientWrapper() },
  );
}

describe("GenomeDetailPanel member lookup", () => {
  it("reads the row through the same-origin gateway, never the upstream data API", async () => {
    const requested: string[] = [];
    server.use(
      http.get("/api/data/genome_sequence", ({ request }) => {
        requested.push(request.url);
        return HttpResponse.json({
          row: { sequence_id: "94625.28.con.0340", accession: "CP000123" },
        });
      }),
    );

    renderPanel("94625.28.con.0340");

    await waitFor(() => {
      expect(requested.length).toBeGreaterThan(0);
    });
    const url = new URL(requested[0]);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get("operation")).toBe("member");
    expect(url.searchParams.get("id")).toBe("94625.28.con.0340");
    expect(url.searchParams.get("idField")).toBe("sequence_id");
    // Projected to the same fields the list projects, so a cache-miss row has
    // the same shape as the cache-populated one — and never drags in the raw
    // `sequence` column, which is not among them.
    const fields = url.searchParams.getAll("field");
    expect(fields).toContain("sequence_id");
    expect(fields).toContain("accession");
    expect(fields).not.toContain("sequence");
  });

  it("shows the real failure message instead of a generic one", async () => {
    server.use(
      http.get("/api/data/genome_sequence", () =>
        HttpResponse.json(
          { error: "Malformed genome_sequence response.", code: "malformed_response" },
          { status: 502 },
        ),
      ),
    );

    renderPanel("94625.28.con.0340");

    expect(
      await screen.findByText("Malformed genome_sequence response."),
    ).toBeInTheDocument();
  });
});
