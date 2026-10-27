import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { TaxonomyLookupNote } from "@/components/services/taxonomy-lookup-note";
import { applyTaxonomyIdWithLookup } from "@/lib/forms/taxonomy-lookup";
import { server } from "@/test-helpers/msw-server";

describe("TaxonomyLookupNote", () => {
  beforeEach(() => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json(
          { error: "BV-BRC Taxonomy API error: 503 Service Unavailable" },
          { status: 503 },
        ),
      ),
    );
  });

  it("says the rerun's taxonomy ID could not be verified, and why", async () => {
    const form = { setFieldValue: vi.fn() };
    render(<TaxonomyLookupNote form={form} taxonomyId="83332" />);

    applyTaxonomyIdWithLookup("83332", form);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not verify taxonomy ID 83332: BV-BRC Taxonomy API error: 503 Service Unavailable",
    );
  });

  it("goes once the form holds another taxonomy ID", async () => {
    const form = { setFieldValue: vi.fn() };
    const { rerender } = render(
      <TaxonomyLookupNote form={form} taxonomyId="83332" />,
    );
    applyTaxonomyIdWithLookup("83332", form);
    await screen.findByRole("alert");

    rerender(<TaxonomyLookupNote form={form} taxonomyId="1773" />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
