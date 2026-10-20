import { render, screen } from "@testing-library/react";
import { JobsPagination, type JobsListStatus } from "../jobs-pagination";

function renderFooter(status: JobsListStatus | undefined, totalTasks: number) {
  return render(
    <JobsPagination
      status={status}
      offset={0}
      limit={25}
      totalOnPage={Math.min(totalTasks, 25)}
      totalTasks={totalTasks}
      onPrevious={vi.fn()}
      onNext={vi.fn()}
      onPageSizeChange={vi.fn()}
      onPageChange={vi.fn()}
    />,
  );
}

describe("JobsPagination summary", () => {
  it("says the list is loading rather than that there are no jobs", () => {
    renderFooter("loading", 0);
    expect(screen.getByText("Loading jobs…")).toBeInTheDocument();
    expect(screen.queryByText(/no jobs/i)).toBeNull();
  });

  it("shows no count when the list failed", () => {
    renderFooter("error", 0);
    expect(screen.queryByText(/no jobs/i)).toBeNull();
    expect(screen.queryByText(/showing/i)).toBeNull();
    expect(screen.queryByText(/loading/i)).toBeNull();
  });

  it.each([
    [undefined, 0, "No jobs found"],
    ["ready" as const, 0, "No jobs found"],
    ["ready" as const, 40, "Showing 1–25 of 40 jobs"],
  ])("reports a loaded list (status %s, %d jobs)", (status, total, text) => {
    renderFooter(status, total);
    expect(screen.getByText(text)).toBeInTheDocument();
  });
});
