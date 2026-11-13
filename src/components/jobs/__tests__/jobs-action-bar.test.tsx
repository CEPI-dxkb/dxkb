import { render, screen } from "@testing-library/react";
import type { JobListItem } from "@/types/workspace";
import { JobsActionBar } from "../jobs-action-bar";

function jobWith(status: JobListItem["status"]): JobListItem {
  return {
    id: "1",
    app: "GenomeAssembly2",
    status,
    submit_time: "2026-10-19T09:55:00Z",
    parameters: {},
  } as unknown as JobListItem;
}

describe("JobsActionBar kill", () => {
  it.each(["queued", "pending", "init", "running", "in-progress"] as const)(
    "is offered for a %s job",
    (status) => {
      render(<JobsActionBar selection={[jobWith(status)]} onAction={vi.fn()} />);
      expect(screen.getByRole("button", { name: "KILL" })).toBeInTheDocument();
    },
  );

  it.each(["completed", "failed", "deleted"] as const)(
    "is not offered for a %s job",
    (status) => {
      render(<JobsActionBar selection={[jobWith(status)]} onAction={vi.fn()} />);
      expect(screen.queryByRole("button", { name: "KILL" })).toBeNull();
    },
  );

  it("is not offered when one selected job is finished", () => {
    render(
      <JobsActionBar
        selection={[jobWith("pending"), jobWith("completed")]}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "KILL" })).toBeNull();
  });
});
