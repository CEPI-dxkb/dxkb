import { render, screen } from "@testing-library/react";
import { createQueryClientWrapper } from "@/test-helpers/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import InfluenzaHaSubtypePage from "../page";

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

vi.mock("@/components/forms/required-form-components", () => ({
  RequiredFormCardTitle: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/services/output-folder", () => ({
  default: () => null,
}));

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: () => null,
}));

/** The bordered box that holds the scheme checkboxes. */
function schemeBox() {
  return screen.getByRole("checkbox", { name: "H3" }).closest("div.grid");
}

describe("HA Subtype Numbering Scheme", () => {
  it("chooses no scheme by default, as legacy does", () => {
    render(<InfluenzaHaSubtypePage />, { wrapper: createQueryClientWrapper() });

    expect(screen.getAllByRole("checkbox")).not.toHaveLength(0);
    for (const checkbox of screen.getAllByRole("checkbox")) {
      expect(checkbox).not.toBeChecked();
    }
  });

  it("draws the box in the error state until a scheme is chosen", async () => {
    const user = userEvent.setup();
    render(<InfluenzaHaSubtypePage />, { wrapper: createQueryClientWrapper() });

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(
      await screen.findByText("Select at least one numbering scheme"),
    ).toBeVisible();
    expect(schemeBox()).toHaveClass("border-destructive");

    await user.click(screen.getByRole("checkbox", { name: "H3" }));

    expect(
      screen.queryByText("Select at least one numbering scheme"),
    ).not.toBeInTheDocument();
    expect(schemeBox()).not.toHaveClass("border-destructive");
  });
});
