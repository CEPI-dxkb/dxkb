import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { rerunJob } = vi.hoisted(() => ({ rerunJob: vi.fn() }));
vi.mock("@/lib/rerun-utility", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rerun-utility")>()),
  rerunJob,
}));

import { rerunPopupBlockedMessage } from "@/lib/rerun-utility";
import { TaxonomyServiceChooser } from "../taxonomy-service-chooser";

describe("TaxonomyServiceChooser", () => {
  beforeEach(() => {
    rerunJob.mockReset().mockReturnValue({ status: "opened" });
  });

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

  it("stays open with the launch error when the service tab is blocked", async () => {
    rerunJob.mockReturnValue({
      status: "blockedPopup",
      message: rerunPopupBlockedMessage,
    });
    const onOpenChange = vi.fn();
    render(
      <TaxonomyServiceChooser
        open
        onOpenChange={onOpenChange}
        taxonIds={["234"]}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "BLAST against selected Taxa" }),
    );

    // Closing the dialog here reported a launch that the browser refused.
    expect(screen.getByRole("alert")).toHaveTextContent(
      rerunPopupBlockedMessage,
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
