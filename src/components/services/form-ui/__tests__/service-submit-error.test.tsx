import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "@tanstack/react-form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";

import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { server } from "@/test-helpers/msw-server";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const submitUrl = "*/api/services/app-service/submit";

// Set by a test to make the form's own validation stop the next Submit.
let submitBlocked = false;

function ServiceForm({ serviceName }: { serviceName: string }) {
  const { submit, isSubmitting } = useServiceFormSubmission({
    serviceName,
    displayName: serviceName,
  });
  const form = useForm({
    defaultValues: { name: "" },
    validators: {
      onSubmit: () => (submitBlocked ? "Fix the form first" : undefined),
    },
    onSubmit: () => submit({}),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <ServiceSubmitError form={form} />
      <div className="service-form-controls">
        <button type="button" onClick={() => { form.reset(); }}>
          Reset
        </button>
        <button type="submit" disabled={isSubmitting}>
          Submit
        </button>
      </div>
    </form>
  );
}

function renderWithClient(ui: ReactNode, queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

describe("ServiceSubmitError", () => {
  afterEach(() => {
    vi.useRealTimers();
    submitBlocked = false;
  });

  it("keeps the real failure by the Submit row and clears it on the next submit", async () => {
    let attempt = 0;
    let releaseSecond!: () => void;
    const secondHeld = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    server.use(
      http.post(submitUrl, async () => {
        attempt += 1;
        if (attempt === 1) {
          return HttpResponse.json(
            { error: "JSON-RPC call failed: fetch failed", code: "upstream" },
            { status: 502 },
          );
        }
        await secondHeld;
        return HttpResponse.json({ job: [{ id: "job-2" }] });
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<ServiceForm serviceName="BLAST" />, newClient());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Submission failed");
    expect(alert).toHaveTextContent("JSON-RPC call failed: fetch failed");
    expect(
      screen.queryByRole("button", { name: "View Jobs" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    releaseSecond();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("drops the failure on Reset, and a Submit the form blocks keeps it gone", async () => {
    let attempt = 0;
    server.use(
      http.post(submitUrl, () => {
        attempt += 1;
        return HttpResponse.json(
          { error: `bad params ${String(attempt)}` },
          { status: 400 },
        );
      }),
    );
    const user = userEvent.setup();
    renderWithClient(<ServiceForm serviceName="BLAST" />, newClient());

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad params 1");

    // The failure was about the inputs Reset just cleared.
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Validation stops this Submit before any job is sent; the old failure
    // must not come back with it.
    submitBlocked = true;
    await user.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
    expect(attempt).toBe(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // A submission after the Reset still reports its own failure.
    submitBlocked = false;
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad params 2");
  });

  it("offers a way to check Jobs when the job service timed out", async () => {
    const message =
      "The BV-BRC job service did not respond within 30 s. Your job may still have been queued: check Jobs before you submit it again.";
    server.use(
      http.post(submitUrl, () =>
        HttpResponse.json({ error: message, code: "upstream" }, { status: 504 }),
      ),
    );
    const user = userEvent.setup();
    renderWithClient(<ServiceForm serviceName="BLAST" />, newClient());

    await user.click(screen.getByRole("button", { name: "Submit" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The job service did not respond");
    expect(alert).toHaveTextContent("may still have been queued");
    expect(screen.getByRole("button", { name: "View Jobs" })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });

  it("never shows a failure from an earlier visit or another form", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    server.use(
      http.post(submitUrl, () =>
        HttpResponse.json({ error: "bad params" }, { status: 400 }),
      ),
    );
    const user = userEvent.setup();
    // One client for the whole session: the mutation cache outlives navigation.
    const queryClient = newClient();

    const firstVisit = renderWithClient(
      <ServiceForm serviceName="BLAST" />,
      queryClient,
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("bad params");
    firstVisit.unmount();

    // The failed mutation is still cached; navigating elsewhere must not show it.
    expect(
      queryClient.getMutationCache().findAll({ status: "error" }),
    ).toHaveLength(1);
    vi.setSystemTime(new Date("2026-10-19T12:01:00Z"));

    const otherForm = renderWithClient(
      <ServiceForm serviceName="GenomeAssembly2" />,
      queryClient,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    otherForm.unmount();

    vi.setSystemTime(new Date("2026-10-19T12:02:00Z"));
    renderWithClient(<ServiceForm serviceName="BLAST" />, queryClient);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
