import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";
import type { JobListItem } from "@/types/workspace";
import { JobDetailsPanel } from "../jobs-detail-panel";

const job: JobListItem = {
  id: "9000001",
  app: "GenomeAssembly2",
  status: "failed",
  submit_time: "2026-10-19T09:55:00Z",
  owner: "test-user",
  parameters: {},
};

const stdoutUrl = `/api/services/app-service/jobs/${job.id}/stdout`;
const outageMessage =
  "Failed to fetch stdout for job 9000001: The BV-BRC job service did not respond: connection timed out after 10 s.";

function renderPanel() {
  return render(<JobDetailsPanel job={job} />, {
    wrapper: createQueryClientWrapper(),
  });
}

describe("JobDetailsPanel output sections", () => {
  it("shows why the output failed to load and retries it", async () => {
    server.use(
      http.get(stdoutUrl, () =>
        HttpResponse.json(
          { error: outageMessage, code: "upstream_timeout" },
          { status: 504 },
        ),
      ),
    );

    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /standard output/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(`Failed to load output: ${outageMessage}`);

    let releaseRetry: () => void = () => undefined;
    server.use(
      http.get(stdoutUrl, async () => {
        await new Promise<void>((resolve) => {
          releaseRetry = resolve;
        });
        return new HttpResponse("Assembly complete.\n", {
          headers: { "Content-Type": "text/plain" },
        });
      }),
    );
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    // The failure stays up, retrying, instead of going back to "Loading…".
    expect(
      await within(alert).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(screen.queryByText("Loading…")).toBeNull();

    act(() => {
      releaseRetry();
    });

    expect(await screen.findByText("Assembly complete.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("falls back to a description when the failure carries no message", async () => {
    server.use(
      http.get(stdoutUrl, () => HttpResponse.json({ error: " " }, { status: 500 })),
    );

    renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /standard output/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed to load output: The job service did not return this output.",
    );
  });
});
