import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobMetadataCard } from "../job-metadata-card";
import type { ResolvedPathObject } from "@/lib/services/workspace/types";

// The sibling job-metadata-card.test.tsx mocks the Collapsible file-wide, so
// this file leaves it real to cover the open/close wiring.
function makeMeta(
  overrides?: Partial<ResolvedPathObject>,
): ResolvedPathObject {
  return {
    name: "TestJob",
    type: "job_result",
    path: "/user/home/TestJob",
    creation_time: "2024-01-01",
    id: "job-123",
    owner_id: "user@bvbrc",
    size: 0,
    userMeta: {},
    sysMeta: {},
    jobSysMeta: {
      id: "meta-id-1",
      app: { label: "Genome Assembly" },
      start_time: 1700000000,
      end_time: 1700003600,
      elapsed_time: 3600,
      parameters: { output_file: "result.fasta", recipe: "auto" },
    },
    taskData: undefined,
    ...overrides,
  };
}

describe("JobMetadataCard Job Parameters", () => {
  it("opens and closes the parameters panel from its trigger", async () => {
    const user = userEvent.setup();
    render(<JobMetadataCard resolvedJobMeta={makeMeta()} />);
    const trigger = screen.getByRole("button", { name: "Job Parameters" });
    const panel = screen
      .getByText(/"output_file"/)
      .closest('[data-slot="collapsible-content"]');
    expect(panel).toHaveAttribute("hidden");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    await waitFor(() => {
      expect(panel).not.toHaveAttribute("hidden");
    });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTitle("Copy to clipboard")).toBeVisible();

    await user.click(trigger);
    await waitFor(() => {
      expect(panel).toHaveAttribute("hidden");
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
