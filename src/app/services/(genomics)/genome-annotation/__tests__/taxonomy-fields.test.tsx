import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import GenomeAnnotationPage from "../page";
import { generateOutputFileName } from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-utils";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

vi.mock("@/hooks/services/use-service-runtime", () => ({
  useServiceRuntime: () => ({
    isSubmitting: false,
    jobParamsDialogProps: {},
    submitFormData: vi.fn(),
  }),
}));

vi.mock("@/components/services/job-params-dialog", () => ({
  JobParamsDialog: () => null,
}));

vi.mock("@/components/services/service-header", () => ({
  ServiceHeader: () => null,
}));

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: () => null,
}));

// Shows the value each OutputFolder holds, so the test can read the generated
// output name.
vi.mock("@/components/services/output-folder", () => ({
  default: ({ variant, value }: { variant?: string; value?: string }) => (
    <input
      aria-label={variant === "name" ? "Output Name" : "Output Folder"}
      value={value ?? ""}
      readOnly
    />
  ),
}));

const anthracis = {
  taxon_id: "1392",
  taxon_name: "Bacillus anthracis",
  taxon_rank: "species",
  division: "Bacteria",
};

describe("Genome Annotation taxonomy fields", () => {
  beforeEach(() => {
    // Both selectors search the same proxy: the ID selector with
    // `q=taxon_id:<id>`, the name selector with its own name query.
    server.use(
      http.get("*/api/services/taxonomy", ({ request }) => {
        const query = new URL(request.url).searchParams.get("q") ?? "";
        return HttpResponse.json(
          query.startsWith("taxon_id:") ? [anthracis] : [],
        );
      }),
    );
  });

  it("lets the user type a Taxonomy ID, and picking a match fills the name and output name", async () => {
    const user = userEvent.setup();
    render(<GenomeAnnotationPage />, { wrapper: createQueryClientWrapper() });

    await user.type(screen.getByPlaceholderText("My identifier123"), "run1");

    const taxonId = screen.getByLabelText("Taxonomy ID");
    // Editable, not the read-only "Select a taxon name first" box it was.
    expect(taxonId).toBeEnabled();
    expect(taxonId).not.toHaveAttribute("readonly");
    expect(taxonId).toHaveAttribute("placeholder", "NCBI Taxonomy ID");

    await user.type(taxonId, "1392");
    await user.click(
      await screen.findByRole("button", { name: /Bacillus anthracis/ }),
    );

    expect(taxonId).toHaveValue("1392");
    await waitFor(() => {
      expect(screen.getByPlaceholderText("e.g. Bacillus cereus...")).toHaveValue(
        "Bacillus anthracis",
      );
    });
    expect(screen.getByLabelText("Output Name")).toHaveValue(
      generateOutputFileName("Bacillus anthracis", "run1"),
    );
  });

  it("clears the Taxonomy Name when the Taxonomy ID is edited away from the match", async () => {
    const user = userEvent.setup();
    render(<GenomeAnnotationPage />, { wrapper: createQueryClientWrapper() });

    const taxonId = screen.getByLabelText("Taxonomy ID");
    await user.type(taxonId, "1392");
    await user.click(
      await screen.findByRole("button", { name: /Bacillus anthracis/ }),
    );
    const taxonName = screen.getByPlaceholderText("e.g. Bacillus cereus...");
    await waitFor(() => {
      expect(taxonName).toHaveValue("Bacillus anthracis");
    });

    await user.type(taxonId, "9");

    await waitFor(() => {
      expect(taxonName).toHaveValue("");
    });
  });
});
