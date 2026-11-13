import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { delay, http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { server } from "@/test-helpers/msw-server";
import { createUiPreferencesWrapper } from "@/test-helpers/react";
import { stubResizableGeometry } from "@/test-helpers/resizable";
import { JobsBrowser } from "../jobs-browser";

vi.mock("next/navigation", async () =>
  (await import("@/test-helpers/history-navigation")).historyNavigationMock({
    pathname: "/jobs",
  }),
);

// The jobs shell is a resizable panel group, which measures its panels.
stubResizableGeometry(800);

const listUrl = "/api/services/app-service/jobs/enumerate-tasks-filtered";
const summaryUrl = "/api/services/app-service/jobs/summary";
const outageMessage =
  "The BV-BRC job service did not respond: connection timed out after 10 s.";

const job = {
  id: "9000001",
  app: "GenomeAssembly2",
  status: "completed",
  submit_time: "2026-10-19T09:55:00Z",
  owner: "test-user",
  parameters: { output_file: "my assembly" },
};

function okSummary() {
  return HttpResponse.json({
    taskSummary: { completed: 1 },
    appSummary: { GenomeAssembly2: 1 },
  });
}

function outage() {
  return HttpResponse.json(
    { error: outageMessage, code: "upstream_timeout" },
    { status: 504 },
  );
}

function renderBrowser() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Preferences = createUiPreferencesWrapper();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <Preferences>{children}</Preferences>
      </QueryClientProvider>
    );
  }
  return { queryClient, ...render(<JobsBrowser />, { wrapper: Wrapper }) };
}

describe("JobsBrowser load states", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/jobs");
  });

  it("says nothing about the number of jobs while the first load is in flight", async () => {
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, async () => {
        await delay("infinite");
        return HttpResponse.json({ jobs: [], totalTasks: 0 });
      }),
    );

    renderBrowser();

    expect(await screen.findByText("Loading jobs…")).toBeInTheDocument();
    expect(screen.queryByText(/no jobs/i)).toBeNull();
  });

  it("replaces the table with the real reason and a Retry when the list fails", async () => {
    let failing = true;
    let releaseRetry: () => void = () => undefined;
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, async () => {
        if (failing) return outage();
        await new Promise<void>((resolve) => {
          releaseRetry = resolve;
        });
        return HttpResponse.json({ jobs: [job], totalTasks: 1 });
      }),
    );

    renderBrowser();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Could not load jobs")).toBeInTheDocument();
    expect(within(alert).getByText(outageMessage)).toBeInTheDocument();
    expect(screen.queryByText(/no jobs/i)).toBeNull();
    expect(screen.queryByText(/showing/i)).toBeNull();
    expect(screen.queryByRole("region", { name: "Jobs list" })).toBeNull();

    failing = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));

    expect(
      await within(alert).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(alert).toBeInTheDocument();
    expect(within(alert).getByText(outageMessage)).toBeInTheDocument();
    expect(screen.queryByText("Loading jobs…")).toBeNull();
    expect(screen.queryByText(/no jobs|showing/i)).toBeNull();
    expect(screen.queryByRole("region", { name: "Jobs list" })).toBeNull();

    act(() => {
      releaseRetry();
    });

    expect(await screen.findByText("my assembly")).toBeInTheDocument();
    expect(screen.queryByText("Could not load jobs")).toBeNull();
    expect(screen.getByText(/of 1 jobs/)).toBeInTheDocument();
  });

  it("drops the kept error when another filter is picked during a retry", async () => {
    let failing = true;
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, async () => {
        if (failing) return outage();
        await delay("infinite");
        return HttpResponse.json({ jobs: [job], totalTasks: 1 });
      }),
    );

    renderBrowser();
    const alert = await screen.findByRole("alert");
    failing = false;
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await within(alert).findByRole("button", { name: "Retrying…" });

    await userEvent.click(screen.getByRole("checkbox", { name: /archived/i }));

    expect(await screen.findByText("Loading jobs…")).toBeInTheDocument();
    expect(screen.queryByText("Could not load jobs")).toBeNull();
  });

  it("keeps the rows and adds a non-blocking notice when a later poll fails", async () => {
    let failing = false;
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, () =>
        failing ? outage() : HttpResponse.json({ jobs: [job], totalTasks: 1 }),
      ),
    );

    const { queryClient } = renderBrowser();
    expect(await screen.findByText("my assembly")).toBeInTheDocument();

    failing = true;
    await act(() => queryClient.refetchQueries({ queryKey: ["jobs-filtered"] }));

    const notice = await screen.findByText(
      (_, element) =>
        element?.getAttribute("role") === "status" &&
        element.textContent.includes("Could not refresh jobs"),
    );
    expect(notice).toHaveTextContent(outageMessage);
    expect(screen.getByText("my assembly")).toBeInTheDocument();
    expect(screen.queryByText("Could not load jobs")).toBeNull();

    let releaseRetry: () => void = () => undefined;
    server.use(
      http.post(listUrl, async () => {
        await new Promise<void>((resolve) => {
          releaseRetry = resolve;
        });
        return HttpResponse.json({ jobs: [job], totalTasks: 1 });
      }),
    );
    await userEvent.click(within(notice).getByRole("button", { name: "Retry" }));
    expect(
      await within(notice).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(screen.getByText("my assembly")).toBeInTheDocument();

    act(() => {
      releaseRetry();
    });
    await waitFor(() => {
      expect(screen.queryByText("Could not refresh jobs")).toBeNull();
    });
  });

  it("still shows the empty state once a list really comes back empty", async () => {
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, () => HttpResponse.json({ jobs: [], totalTasks: 0 })),
    );

    renderBrowser();

    await waitFor(() => {
      expect(screen.getAllByText("No jobs found")).toHaveLength(2);
    });
    expect(screen.getByRole("region", { name: "Jobs list" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says the counts and the service list are unavailable when the summary fails", async () => {
    server.use(
      http.post(summaryUrl, outage),
      http.post(listUrl, () => HttpResponse.json({ jobs: [job], totalTasks: 1 })),
    );

    renderBrowser();

    expect(
      await screen.findByText(
        `Job counts and the service list are unavailable: ${outageMessage}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("my assembly")).toBeInTheDocument();
  });

  it("gives one outage's reason once when both the list and the summary fail", async () => {
    server.use(http.post(summaryUrl, outage), http.post(listUrl, outage));

    renderBrowser();

    expect(await screen.findByText("Could not load jobs")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(outageMessage, { exact: false })).toHaveLength(1);
    });
    expect(
      screen.queryByText(/Job counts and the service list are unavailable/),
    ).toBeNull();
  });

  it("flags the counts as out of date when a later summary refresh fails", async () => {
    let failing = false;
    server.use(
      http.post(summaryUrl, () => (failing ? outage() : okSummary())),
      http.post(listUrl, () => HttpResponse.json({ jobs: [job], totalTasks: 1 })),
    );

    const { queryClient } = renderBrowser();
    expect(await screen.findByText("my assembly")).toBeInTheDocument();
    expect(await screen.findByText("completed:")).toBeInTheDocument();

    failing = true;
    await act(() => queryClient.refetchQueries({ queryKey: ["jobs-summary"] }));

    const note = await screen.findByText(
      (_, element) =>
        element?.getAttribute("role") === "status" &&
        element.textContent.includes("Counts may be out of date"),
    );
    expect(note).toHaveTextContent(outageMessage);
    expect(screen.getByText("completed:")).toBeInTheDocument();
    expect(
      screen.queryByText(/Job counts and the service list are unavailable/),
    ).toBeNull();
  });

  it("gives one outage's reason once when both reads fail after loading", async () => {
    let failing = false;
    server.use(
      http.post(summaryUrl, () => (failing ? outage() : okSummary())),
      http.post(listUrl, () =>
        failing ? outage() : HttpResponse.json({ jobs: [job], totalTasks: 1 }),
      ),
    );

    const { queryClient } = renderBrowser();
    expect(await screen.findByText("my assembly")).toBeInTheDocument();
    expect(await screen.findByText("completed:")).toBeInTheDocument();

    failing = true;
    await act(() =>
      Promise.all([
        queryClient.refetchQueries({ queryKey: ["jobs-summary"] }),
        queryClient.refetchQueries({ queryKey: ["jobs-filtered"] }),
      ]),
    );

    expect(await screen.findByText("Could not refresh jobs")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText(outageMessage, { exact: false })).toHaveLength(1);
    });
    expect(screen.queryByText(/Counts may be out of date/)).toBeNull();
    expect(screen.getByText("completed:")).toBeInTheDocument();
  });

  it("keeps a service filter from the address in the list when the summary fails", async () => {
    history.replaceState(null, "", "/jobs?service=GenomeAssembly2");
    server.use(
      http.post(summaryUrl, outage),
      http.post(listUrl, () => HttpResponse.json({ jobs: [job], totalTasks: 1 })),
    );

    renderBrowser();

    expect(
      await screen.findByRole("combobox", { name: "Filter by service" }),
    ).toHaveTextContent("Genome Assembly");
  });
});

function heldResponse() {
  let release: (response: Response) => void = () => undefined;
  const response = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { response, release };
}

describe("JobsBrowser queued count", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/jobs");
  });

  it.each([["pending"], ["init"]])(
    "shows queued: 1 for a summary of {%s: 1}",
    async (status) => {
      server.use(
        http.post(summaryUrl, () =>
          HttpResponse.json({
            taskSummary: { [status]: 1 },
            appSummary: { GenomeAssembly2: 1 },
          }),
        ),
        http.post(listUrl, () =>
          HttpResponse.json({ jobs: [{ ...job, status }], totalTasks: 1 }),
        ),
      );

      renderBrowser();

      await waitFor(() => {
        const label = screen.getByText(/^queued:/);
        expect(label).toHaveTextContent("queued: 1");
      });
    },
  );
});

describe("JobsBrowser queued filter", () => {
  it("keeps queued, pending and init rows and drops the rest", async () => {
    history.replaceState(null, "", "/jobs?status=queued");
    const rows = [
      { ...job, id: "9000011", status: "queued" },
      { ...job, id: "9000012", status: "pending" },
      { ...job, id: "9000013", status: "init" },
      { ...job, id: "9000014", status: "completed" },
    ];
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, () =>
        HttpResponse.json({ jobs: rows, totalTasks: rows.length }),
      ),
    );

    renderBrowser();

    expect(await screen.findByText("9000011")).toBeInTheDocument();
    expect(screen.getByText("9000012")).toBeInTheDocument();
    expect(screen.getByText("9000013")).toBeInTheDocument();
    expect(screen.queryByText("9000014")).toBeNull();
  });
});

describe("JobsBrowser background polls during an outage", () => {
  beforeEach(() => {
    history.replaceState(null, "", "/jobs");
  });

  it("keeps the load error up while a back-off poll is in flight", async () => {
    let poll: ReturnType<typeof heldResponse> | null = null;
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, () => poll?.response ?? outage()),
    );

    const { queryClient } = renderBrowser();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(outageMessage);

    const held = heldResponse();
    poll = held;
    act(() => {
      void queryClient.refetchQueries({ queryKey: ["jobs-filtered"] });
    });
    await waitFor(() => {
      expect(
        queryClient.getQueryCache().find({ queryKey: ["jobs-filtered"], exact: false })
          ?.state.fetchStatus,
      ).toBe("fetching");
    });

    expect(screen.getByText("Could not load jobs")).toBeInTheDocument();
    expect(screen.getByText(outageMessage)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.queryByText("Loading jobs…")).toBeNull();
    expect(screen.queryByRole("region", { name: "Jobs list" })).toBeNull();

    act(() => {
      held.release(HttpResponse.json({ jobs: [job], totalTasks: 1 }));
    });
    expect(await screen.findByText("my assembly")).toBeInTheDocument();
    expect(screen.queryByText("Could not load jobs")).toBeNull();
  });

  it("never shows the previous page's rows for a page that failed", async () => {
    const firstPageJob = { ...job, id: "1000001", parameters: { output_file: "page one job" } };
    let secondPage: ReturnType<typeof heldResponse> | null = null;
    history.replaceState(null, "", "/jobs?pageSize=25");
    server.use(
      http.post(summaryUrl, okSummary),
      http.post(listUrl, async ({ request }) => {
        const { offset } = (await request.json()) as { offset: number };
        if (offset === 0) {
          return HttpResponse.json({ jobs: [firstPageJob], totalTasks: 60 });
        }
        return secondPage?.response ?? outage();
      }),
    );

    const { queryClient } = renderBrowser();
    expect(await screen.findByText("page one job")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Could not load jobs")).toBeInTheDocument();
    expect(screen.queryByText("page one job")).toBeNull();

    secondPage = heldResponse();
    act(() => {
      void queryClient.refetchQueries({ queryKey: ["jobs-filtered", 25] });
    });
    await waitFor(() => {
      expect(
        queryClient.getQueryCache().find({ queryKey: ["jobs-filtered", 25], exact: false })
          ?.state.fetchStatus,
      ).toBe("fetching");
    });
    expect(screen.getByText("Could not load jobs")).toBeInTheDocument();
    expect(screen.queryByText("page one job")).toBeNull();
    expect(screen.queryByText(/showing/i)).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Page 1" }));
    expect(await screen.findByText("page one job")).toBeInTheDocument();
    expect(screen.queryByText("Could not load jobs")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Could not load jobs")).toBeInTheDocument();
    expect(screen.getByText(outageMessage)).toBeInTheDocument();
    expect(screen.queryByText("page one job")).toBeNull();
  });

  it("keeps the summary's failure note up while its poll is in flight", async () => {
    let poll: ReturnType<typeof heldResponse> | null = null;
    server.use(
      http.post(summaryUrl, () => poll?.response ?? outage()),
      http.post(listUrl, () => HttpResponse.json({ jobs: [job], totalTasks: 1 })),
    );

    const { queryClient } = renderBrowser();
    const note = `Job counts and the service list are unavailable: ${outageMessage}`;
    expect(await screen.findByText(note)).toBeInTheDocument();

    poll = heldResponse();
    act(() => {
      void queryClient.refetchQueries({ queryKey: ["jobs-summary"] });
    });
    await waitFor(() => {
      expect(
        queryClient.getQueryCache().find({ queryKey: ["jobs-summary"], exact: false })
          ?.state.fetchStatus,
      ).toBe("fetching");
    });

    expect(screen.getByText(note)).toBeInTheDocument();
  });
});
