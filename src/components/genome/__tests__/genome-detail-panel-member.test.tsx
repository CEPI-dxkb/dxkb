/**
 * GenomeDetailPanel's cache-miss read, for both surviving legacy Search types.
 * The row normally arrives in the query cache from the page `ListData` already
 * loaded; when it does not, the panel reads the member through the same-origin
 * Data API gateway.
 *
 * MSW intercepts the gateway call, so the real request/response path runs — and
 * a regression to a direct `NEXT_PUBLIC_DATA_API` fetch would fail here,
 * because MSW is in strict mode and no handler exists for an upstream URL.
 */
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import type { DataResource } from "@/lib/data-api";
import { GenomeDetailPanel } from "../genome-detail-panel";

/**
 * Each surviving type, with the identity field `src/constants/resources.ts` and
 * the Data API registry agree on, a row, and a projected column that proves the
 * `field` list was honoured.
 */
const cases = [
  {
    resource: "genome_sequence" as DataResource,
    idField: "sequence_id",
    id: "94625.28.con.0340",
    row: { sequence_id: "94625.28.con.0340", accession: "CP000123" },
    projected: "accession",
    // The raw DNA column is not in the list's projection, so a cache-miss row
    // cannot drag an 18MB payload in behind it.
    notProjected: "sequence",
  },
  {
    resource: "genome_amr" as DataResource,
    idField: "id",
    id: "1a2b3c",
    row: {
      id: "1a2b3c",
      antibiotic: "ampicillin",
      measurement_value: ">=32",
      pmid: ["12345", "67890"],
    },
    projected: "antibiotic",
    // genome_amr has no such column; `resistant_phenotype` is the field id the
    // `phenotype` datafields key maps to, so a projection built from the keys
    // instead of the `field` values would miss it.
    notProjected: "phenotype",
  },
];

function renderPanel(resource: DataResource, id: string) {
  return render(
    <GenomeDetailPanel genomeId={id} resource={resource} selectedIds={[id]} />,
    { wrapper: createQueryClientWrapper() },
  );
}

describe.each(cases)(
  "GenomeDetailPanel member lookup ($resource)",
  ({ resource, idField, id, row, projected, notProjected }) => {
    it("reads the row through the same-origin gateway, never the upstream data API", async () => {
      const requested: string[] = [];
      server.use(
        http.get(`/api/data/${resource}`, ({ request }) => {
          requested.push(request.url);
          return HttpResponse.json({ row });
        }),
      );

      renderPanel(resource, id);

      await waitFor(() => {
        expect(requested.length).toBeGreaterThan(0);
      });
      const url = new URL(requested[0]);
      expect(url.origin).toBe(window.location.origin);
      expect(url.searchParams.get("operation")).toBe("member");
      expect(url.searchParams.get("id")).toBe(id);
      expect(url.searchParams.get("idField")).toBe(idField);
      // Projected to the same fields the list projects, so a cache-miss row
      // has the same shape as the cache-populated one.
      const fields = url.searchParams.getAll("field");
      expect(fields).toContain(idField);
      expect(fields).toContain(projected);
      expect(fields).not.toContain(notProjected);
    });

    it("shows the real failure message instead of a generic one", async () => {
      server.use(
        http.get(`/api/data/${resource}`, () =>
          HttpResponse.json(
            {
              error: `Malformed ${resource} response.`,
              code: "malformed_response",
            },
            { status: 502 },
          ),
        ),
      );

      renderPanel(resource, id);

      expect(
        await screen.findByText(`Malformed ${resource} response.`),
      ).toBeInTheDocument();
    });
  },
);
