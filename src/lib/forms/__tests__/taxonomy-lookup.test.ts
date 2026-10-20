import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import {
  applyTaxonomyIdWithLookup,
  describeTaxonomyLookupFailure,
  fetchTaxonNameById,
  useTaxonomyLookupFailure,
} from "@/lib/forms/taxonomy-lookup";
import { server } from "@/test-helpers/msw-server";

const taxonomyUrl = "*/api/services/taxonomy";
const outage = () =>
  HttpResponse.json(
    {
      error: "BV-BRC Taxonomy API error: 503 Service Unavailable",
      code: "service_unavailable",
    },
    { status: 503 },
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchTaxonNameById", () => {
  it("finds the taxon name by ID", async () => {
    let query: string | null = null;
    server.use(
      http.get(taxonomyUrl, ({ request }) => {
        query = new URL(request.url).searchParams.get("q");
        return HttpResponse.json({
          response: { docs: [{ taxon_id: 83332, taxon_name: "Mycobacterium tuberculosis H37Rv" }] },
        });
      }),
    );

    await expect(fetchTaxonNameById("83332")).resolves.toEqual({
      status: "found",
      name: "Mycobacterium tuberculosis H37Rv",
    });
    expect(query).toBe("taxon_id:83332");
  });

  it("reports an unknown ID as not found", async () => {
    server.use(
      http.get(taxonomyUrl, () => HttpResponse.json({ response: { docs: [] } })),
    );

    await expect(fetchTaxonNameById("1")).resolves.toEqual({
      status: "notFound",
    });
  });

  it("reports an outage as a failure with the service's reason, not as not found", async () => {
    server.use(http.get(taxonomyUrl, outage));

    await expect(fetchTaxonNameById("83332")).resolves.toEqual({
      status: "failed",
      error: "BV-BRC Taxonomy API error: 503 Service Unavailable",
    });
  });
});

describe("applyTaxonomyIdWithLookup", () => {
  it("keeps the restored name and reports why it could not be verified", async () => {
    server.use(http.get(taxonomyUrl, outage));
    const form = { setFieldValue: vi.fn() };
    const onFailed = vi.fn();
    const onResolved = vi.fn();

    applyTaxonomyIdWithLookup("83332", form, { onFailed, onResolved });

    await vi.waitFor(() => {
      expect(onFailed).toHaveBeenCalledWith(
        "BV-BRC Taxonomy API error: 503 Service Unavailable",
      );
    });
    expect(form.setFieldValue).toHaveBeenCalledTimes(1);
    expect(form.setFieldValue).toHaveBeenCalledWith("taxonomy_id", "83332");
    expect(onResolved).not.toHaveBeenCalled();
  });

  it("sets the looked-up name when the lookup succeeds", async () => {
    server.use(
      http.get(taxonomyUrl, () =>
        HttpResponse.json([{ taxon_id: 83332, taxon_name: "Mycobacterium tuberculosis H37Rv" }]),
      ),
    );
    const form = { setFieldValue: vi.fn() };
    const onResolved = vi.fn();

    applyTaxonomyIdWithLookup("83332", form, { onResolved });

    await vi.waitFor(() => {
      expect(onResolved).toHaveBeenCalledWith("Mycobacterium tuberculosis H37Rv");
    });
    expect(form.setFieldValue).toHaveBeenCalledWith(
      "scientific_name",
      "Mycobacterium tuberculosis H37Rv",
    );
  });

  it("records the failure for its form until the next lookup succeeds", async () => {
    let attempts = 0;
    server.use(
      http.get(taxonomyUrl, () => {
        attempts += 1;
        return attempts === 1
          ? outage()
          : HttpResponse.json([{ taxon_id: 83332, taxon_name: "Mycobacterium tuberculosis H37Rv" }]);
      }),
    );
    const form = { setFieldValue: vi.fn() };
    const otherForm = { setFieldValue: vi.fn() };
    const { result } = renderHook(() => ({
      failure: useTaxonomyLookupFailure(form),
      other: useTaxonomyLookupFailure(otherForm),
    }));

    applyTaxonomyIdWithLookup("83332", form);

    await waitFor(() => {
      expect(result.current.failure).toEqual({
        taxonomyId: "83332",
        error: "BV-BRC Taxonomy API error: 503 Service Unavailable",
      });
    });
    expect(result.current.other).toBeNull();
    expect(
      describeTaxonomyLookupFailure({ taxonomyId: "83332", error: "down" }),
    ).toBe("Could not verify taxonomy ID 83332: down");

    applyTaxonomyIdWithLookup("83332", form);
    await waitFor(() => {
      expect(result.current.failure).toBeNull();
    });
  });
});
