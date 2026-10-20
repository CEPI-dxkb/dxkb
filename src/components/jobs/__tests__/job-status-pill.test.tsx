import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { delay, http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "@/test-helpers/msw-server";
import {
  createQueryClientWrapper,
  nextRefetchInterval,
} from "@/test-helpers/react";
import type { JobListItem } from "@/types/workspace";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    isAuthenticated: true,
    isSessionUnverified: false,
    user: { username: "test-user" },
    status: "authed",
    signOut: vi.fn(),
  },
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => mockAuth,
}));

import { JobStatusPill } from "../job-status-pill";

function renderPill() {
  return render(<JobStatusPill />, { wrapper: createQueryClientWrapper() });
}

/** Like renderPill, with the QueryClient exposed to drive and inspect polls. */
function renderPillWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }
  return { queryClient, ...render(<JobStatusPill />, { wrapper: Wrapper }) };
}

const outageMessage =
  "The BV-BRC job service did not respond: connection timed out after 10 s.";

function mockSummaryOutage() {
  server.use(
    http.post("/api/services/app-service/jobs/summary", () =>
      HttpResponse.json(
        { error: outageMessage, code: "upstream_timeout" },
        { status: 504 },
      ),
    ),
  );
}

function mockSummary(taskSummary: Record<string, number>) {
  server.use(
    http.post("/api/services/app-service/jobs/summary", () =>
      HttpResponse.json({ taskSummary, appSummary: {} }),
    ),
  );
}

function mockJobsList(jobs: Partial<JobListItem>[]) {
  server.use(
    http.post("/api/services/app-service/jobs/enumerate-tasks-filtered", () =>
      HttpResponse.json({ jobs, totalTasks: jobs.length }),
    ),
  );
}

function setAuth(authed: boolean) {
  Object.assign(mockAuth, {
    isAuthenticated: authed,
    status: authed ? "authed" : "guest",
  });
}

describe("JobStatusPill", () => {
  beforeEach(() => {
    setAuth(true);
    mockAuth.isSessionUnverified = false;
    // Default: no jobs so pill is hidden unless tests override
    mockSummary({});
    mockJobsList([]);
  });

  it("renders nothing when unauthenticated", async () => {
    setAuth(false);
    mockSummary({ completed: 3 });
    renderPill();
    // Wait for potential async data and confirm nothing rendered
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole("button", { name: /view job status/i }),
    ).toBeNull();
  });

  it("renders nothing when displayable count is zero (no completed/running/queued jobs)", async () => {
    mockSummary({});
    renderPill();
    await new Promise((r) => setTimeout(r, 50));
    expect(
      screen.queryByRole("button", { name: /view job status/i }),
    ).toBeNull();
  });

  it("renders nothing when only failed/error/cancelled jobs exist", async () => {
    mockSummary({ failed: 2, error: 1, cancelled: 3 });
    renderPill();
    await new Promise((r) => setTimeout(r, 50));
    // totalCount > 0 but displayableCount (completed + running + queued) = 0 → null
    expect(
      screen.queryByRole("button", { name: /view job status/i }),
    ).toBeNull();
  });

  it("renders the pill with completed count", async () => {
    mockSummary({ completed: 5 });
    mockJobsList([]);
    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders running count aggregating running and in-progress statuses", async () => {
    mockSummary({ running: 2, "in-progress": 1 });
    mockJobsList([]);
    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders queued count aggregating queued and pending statuses", async () => {
    mockSummary({ queued: 1, pending: 2 });
    mockJobsList([]);
    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders multiple status groups without index-based keys causing stale order", async () => {
    mockSummary({ completed: 4, running: 2, queued: 1 });
    mockJobsList([]);
    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );
    const counts = screen.getAllByText(/^\d+$/);
    // Left to right: queued, running, completed.
    expect(counts.map((el) => el.textContent)).toEqual(["1", "2", "4"]);
  });

  it("always shows running and queued counts, even when they are zero", async () => {
    mockSummary({ completed: 245 });
    mockJobsList([]);
    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );
    const counts = screen.getAllByText(/^\d+$/);
    expect(counts.map((el) => el.textContent)).toEqual(["0", "0", "245"]);
  });

  it("hides the completed count when there are no completed jobs", async () => {
    mockSummary({ running: 1, failed: 2 });
    mockJobsList([]);
    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );
    const counts = screen.getAllByText(/^\d+$/);
    expect(counts.map((el) => el.textContent)).toEqual(["0", "1"]);
  });

  it("spins the running icon's ring while jobs are running", async () => {
    mockSummary({ running: 1 });
    mockJobsList([]);
    renderPill();
    const pill = await screen.findByRole("button", {
      name: /view job status/i,
    });
    expect(pill.querySelector(".lucide-circle-play-spinner")).not.toBeNull();
  });

  it("shows a still circle-play icon when nothing is running", async () => {
    mockSummary({ completed: 1 });
    mockJobsList([]);
    renderPill();
    const pill = await screen.findByRole("button", {
      name: /view job status/i,
    });
    expect(pill.querySelector(".lucide-circle-play")).not.toBeNull();
    expect(pill.querySelector(".animate-spin")).toBeNull();
  });

  it("shows loading state while jobs list is fetching", async () => {
    // Summary resolves immediately; enumerate stalls
    mockSummary({ completed: 1 });
    server.use(
      http.post(
        "/api/services/app-service/jobs/enumerate-tasks-filtered",
        async () => {
          await new Promise((r) => setTimeout(r, 500));
          return HttpResponse.json({ jobs: [], totalTasks: 0 });
        },
      ),
    );

    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /view job status/i }),
    );
    expect(await screen.findByText("Loading…")).toBeInTheDocument();
  });

  it("shows job list with service name and no job time when loaded", async () => {
    mockSummary({ running: 1 });
    const job: Partial<JobListItem> = {
      id: "job-001",
      app: "GenomeAssembly2",
      status: "running",
      elapsed_time: 90,
      submit_time: "2026-01-01T00:00:00Z",
      owner: "test",
      parameters: {},
    };
    mockJobsList([job]);

    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /view job status/i }),
    );

    await waitFor(() =>
      expect(screen.getByText("Genome Assembly")).toBeInTheDocument(),
    );
    expect(screen.queryByText("1m30s")).toBeNull();
  });

  it.each(["completed", "failed"] as const)(
    "links a %s job's name to its workspace result",
    async (status) => {
      mockSummary({ completed: 1 });
      mockJobsList([
        {
          id: "job-002",
          app: "Homology",
          status,
          submit_time: "2026-01-01T00:00:00Z",
          owner: "test",
          output_path: "/test@bvbrc/home/Results",
          output_file: "my blast",
          parameters: {},
        },
      ]);

      renderPill();
      await userEvent.click(
        await screen.findByRole("button", { name: /view job status/i }),
      );

      const link = await screen.findByRole("link", { name: /my blast/ });
      expect(link).toHaveTextContent("BLAST · my blast");
      expect(link).toHaveAttribute(
        "href",
        "/workspace/test@bvbrc/home/Results/my%20blast",
      );
    },
  );

  it.each(["pending", "queued", "running", "in-progress"] as const)(
    "does not link a %s job's name, whose result does not exist yet",
    async (status) => {
      mockSummary({ running: 1 });
      mockJobsList([
        {
          id: "job-004",
          app: "Homology",
          status,
          submit_time: "2026-01-01T00:00:00Z",
          owner: "test",
          output_path: "/test@bvbrc/home/Results",
          output_file: "my blast",
          parameters: {},
        },
      ]);

      renderPill();
      await userEvent.click(
        await screen.findByRole("button", { name: /view job status/i }),
      );

      expect(await screen.findByText(/my blast/)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /my blast/ })).toBeNull();
    },
  );

  it("shows the service name as plain text when the job has no output location", async () => {
    mockSummary({ completed: 1 });
    mockJobsList([
      {
        id: "job-003",
        app: "Homology",
        status: "completed",
        submit_time: "2026-01-01T00:00:00Z",
        owner: "test",
        parameters: {},
      },
    ]);

    renderPill();
    await userEvent.click(
      await screen.findByRole("button", { name: /view job status/i }),
    );

    expect(await screen.findByText("BLAST")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /blast/i })).toBeNull();
  });

  it("shows 'No recent jobs' when jobs list resolves empty", async () => {
    mockSummary({ completed: 1 });
    mockJobsList([]);

    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /view job status/i }),
    );
    await waitFor(() =>
      expect(screen.getByText("No recent jobs")).toBeInTheDocument(),
    );
  });

  it("popover has an accessible 'My Jobs' title", async () => {
    mockSummary({ completed: 1 });
    mockJobsList([]);

    renderPill();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument(),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /view job status/i }),
    );
    await waitFor(() =>
      expect(screen.getByText("My Jobs")).toBeInTheDocument(),
    );
  });

  describe("when the summary fails", () => {
    it("shows an unavailable pill instead of vanishing, with the reason and a Retry", async () => {
      mockSummaryOutage();
      renderPill();

      const pill = await screen.findByRole("button", {
        name: "Job status unavailable",
      });
      expect(pill).toHaveAttribute(
        "title",
        `Job status unavailable: ${outageMessage}`,
      );

      await userEvent.click(pill);
      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        `Job status unavailable: ${outageMessage}`,
      );
      expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute(
        "href",
        "/jobs",
      );

      let releaseRetry: () => void = () => undefined;
      server.use(
        http.post("/api/services/app-service/jobs/summary", async () => {
          await new Promise<void>((resolve) => {
            releaseRetry = resolve;
          });
          return HttpResponse.json({
            taskSummary: { running: 2 },
            appSummary: {},
          });
        }),
      );
      await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

      // The pill and its popover stay, saying they are retrying, rather than
      // vanishing while the summary is pending again.
      expect(
        await within(alert).findByRole("button", { name: "Retrying…" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Job status unavailable" }),
      ).toBeInTheDocument();
      expect(alert).toHaveTextContent(outageMessage);

      act(() => {
        releaseRetry();
      });

      expect(
        await screen.findByRole("button", { name: /view job status/i }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Job status unavailable" }),
      ).toBeNull();
    });

    it("keeps the last counts and notes the failed refresh in the popover", async () => {
      mockSummary({ running: 2 });
      const { queryClient } = renderPillWithClient();
      const pill = await screen.findByRole("button", {
        name: /view job status/i,
      });

      mockSummaryOutage();
      await act(() =>
        queryClient.refetchQueries({ queryKey: ["jobs-summary"] }),
      );

      expect(within(pill).getByText("2")).toBeInTheDocument();
      await userEvent.click(pill);
      expect(
        await screen.findByText(
          `Could not refresh job status: ${outageMessage} The counts are from the last update.`,
        ),
      ).toBeInTheDocument();
    });
  });

  it("fetches once and does not poll while the session is unverified", async () => {
    mockAuth.isSessionUnverified = true;
    let summaryCalls = 0;
    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        summaryCalls += 1;
        return HttpResponse.json({ taskSummary: { running: 1 }, appSummary: {} });
      }),
    );

    const { queryClient } = renderPillWithClient();
    expect(
      await screen.findByRole("button", { name: /view job status/i }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        queryClient
          .getQueryCache()
          .find({ queryKey: ["jobs-filtered"], exact: false })?.state.status,
      ).toBe("success");
    });

    expect(summaryCalls).toBe(1);
    // A running job would otherwise poll both every 3 s.
    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(false);
    expect(nextRefetchInterval(queryClient, ["jobs-filtered"])).toBe(false);
  });

  it("polls running jobs at the fast rate once the session is verified", async () => {
    mockSummary({ running: 1 });
    const { queryClient } = renderPillWithClient();
    await screen.findByRole("button", { name: /view job status/i });

    expect(nextRefetchInterval(queryClient, ["jobs-summary", false])).toBe(3_000);
  });

  it("holds its place with a loading pill while the first summary is pending", async () => {
    server.use(
      http.post("/api/services/app-service/jobs/summary", async () => {
        await delay("infinite");
        return HttpResponse.json({ taskSummary: {}, appSummary: {} });
      }),
    );

    renderPill();

    expect(
      await screen.findByRole("status", { name: "Loading job status" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the unavailable pill and its open popover up while a back-off poll is in flight", async () => {
    let releasePoll: (response: Response) => void = () => undefined;
    let holding = false;
    server.use(
      http.post("/api/services/app-service/jobs/summary", () => {
        if (!holding) {
          return HttpResponse.json(
            { error: outageMessage, code: "upstream_timeout" },
            { status: 504 },
          );
        }
        return new Promise<Response>((resolve) => {
          releasePoll = resolve;
        });
      }),
    );

    const { queryClient } = renderPillWithClient();
    await userEvent.click(
      await screen.findByRole("button", { name: "Job status unavailable" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(outageMessage);

    // A poll, not a Retry: TanStack puts the data-less summary back to pending.
    holding = true;
    act(() => {
      void queryClient.refetchQueries({ queryKey: ["jobs-summary"] });
    });
    await waitFor(() => {
      expect(
        queryClient.getQueryState(["jobs-summary", false])?.fetchStatus,
      ).toBe("fetching");
    });

    expect(
      screen.getByRole("button", { name: "Job status unavailable" }),
    ).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(outageMessage);
    // Nobody pressed Retry, so it does not claim to be retrying.
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.queryByRole("status", { name: "Loading job status" })).toBeNull();

    act(() => {
      releasePoll(
        HttpResponse.json({ taskSummary: { running: 1 }, appSummary: {} }),
      );
    });
    expect(
      await screen.findByRole("button", { name: /view job status/i }),
    ).toBeInTheDocument();
  });
});
