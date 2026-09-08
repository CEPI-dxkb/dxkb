import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { rerunJob } = vi.hoisted(() => ({ rerunJob: vi.fn() }));
vi.mock("@/lib/rerun-utility", () => ({ rerunJob }));

import { TaxonomyServiceChooser } from "../taxonomy-service-chooser";

describe("TaxonomyServiceChooser", () => {
  it("opens BLAST with selected Taxon IDs in its supported input shape", async () => {
    const onOpenChange = vi.fn();
    render(
      <TaxonomyServiceChooser
        open
        onOpenChange={onOpenChange}
        taxonIds={["234", "10239"]}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "BLAST against selected Taxa" }),
    );

    expect(rerunJob).toHaveBeenCalledWith(
      {
        db_precomputed_database: "selTaxon",
        db_source: "taxon_list",
        db_taxon_list: ["234", "10239"],
      },
      "Homology",
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
