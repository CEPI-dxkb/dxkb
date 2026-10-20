import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

describe("TaxIDSelector search", () => {
  it("lists the proxy's array response and selects a numeric taxon ID", async () => {
    let query: string | null = null;
    server.use(
      http.get("*/api/services/taxonomy", ({ request }) => {
        query = new URL(request.url).searchParams.get("q");
        // BV-BRC's application/json reply: a bare array, taxon_id a string.
        return HttpResponse.json([
          {
            taxon_id: "562",
            taxon_name: "Escherichia coli",
            lineage_names: ["Bacteria", "Escherichia", "Escherichia coli"],
          },
        ]);
      }),
    );
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TaxIDSelector onChange={onChange} />, {
      wrapper: createQueryClientWrapper(),
    });

    const input = screen.getByRole("textbox");
    await user.type(input, "562");
    // The name on the first line, the ID under it, and no lineage.
    const suggestion = await screen.findByRole("button", {
      name: /Escherichia coli/,
    });
    expect(query).toBe("taxon_id:562");
    expect(suggestion).toHaveTextContent(/^Escherichia coli562$/);
    expect(
      screen.queryByText("Bacteria > Escherichia > Escherichia coli"),
    ).not.toBeInTheDocument();

    await user.click(suggestion);

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ taxon_id: 562, taxon_name: "Escherichia coli" }),
    );
    expect(input).toHaveValue("562");
  });

  it("shows the empty message when no taxon matches", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    render(<TaxIDSelector />, { wrapper: createQueryClientWrapper() });

    await user.type(screen.getByRole("textbox"), "999999999");

    expect(
      await screen.findByText("No taxonomy found for ID: 999999999"),
    ).toBeVisible();
  });
});

describe("TaxIDSelector blur", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closes the suggestions shortly after the input loses focus", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    render(<TaxIDSelector />, { wrapper: createQueryClientWrapper() });

    await user.type(screen.getByRole("textbox"), "562");
    const emptyMessage = await screen.findByText(
      "No taxonomy found for ID: 562",
    );
    await user.tab();

    await waitForElementToBeRemoved(emptyMessage);
  });

  it("leaves no timer behind when it unmounts with the close pending", () => {
    // Only timeouts are faked (React's scheduler queues immediates of its
    // own), and an infinite gcTime keeps TanStack Query from scheduling a
    // cache timeout on unmount, so the count below is the selector's alone.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const consoleError = vi.spyOn(console, "error");
    const consoleWarn = vi.spyOn(console, "warn");
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <TaxIDSelector />
      </QueryClientProvider>,
    );
    const input = screen.getByRole("textbox");

    act(() => {
      input.focus();
    });
    act(() => {
      input.blur();
    });
    unmount();

    // A close timer that outlives the component fires after the test's jsdom
    // window is torn down and throws "ReferenceError: window is not defined".
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });
});

describe("TaxIDSelector invalid", () => {
  it("draws the error border for a caller-reported failure without adding a message", () => {
    render(<TaxIDSelector invalid />, { wrapper: createQueryClientWrapper() });

    expect(screen.getByRole("textbox")).toHaveClass("border-destructive");
    expect(screen.queryByText("NCBI Tax ID is required.")).toBeNull();
  });

  it("keeps the default border until the required field is touched", async () => {
    const user = userEvent.setup();
    render(<TaxIDSelector required />, { wrapper: createQueryClientWrapper() });
    const input = screen.getByRole("textbox");

    expect(input).not.toHaveClass("border-destructive");

    await user.click(input);
    await user.tab();

    expect(input).toHaveClass("border-destructive");
    expect(screen.getByText("NCBI Tax ID is required.")).toBeVisible();
  });
});

describe("TaxIDSelector failed search", () => {
  const outage = "BV-BRC Taxonomy API error: 503 Service Unavailable";
  const shownOutage = `Taxonomy search unavailable: ${outage}`;

  /** The proxy's 503 until `recover()`, then one match for 562. */
  function failUntilRecovered() {
    let down = true;
    server.use(
      http.get("*/api/services/taxonomy", () =>
        down
          ? HttpResponse.json(
              { error: outage, code: "upstream" },
              { status: 503 },
            )
          : HttpResponse.json([
              { taxon_id: "562", taxon_name: "Escherichia coli" },
            ]),
      ),
    );
    return {
      recover: () => {
        down = false;
      },
    };
  }

  it("announces the proxy's reason with a Retry that searches again", async () => {
    const { recover } = failUntilRecovered();
    const user = userEvent.setup();
    render(<TaxIDSelector />, { wrapper: createQueryClientWrapper() });

    await user.type(screen.getByRole("textbox"), "562");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(shownOutage);
    expect(screen.queryByText(/HTTP error/)).not.toBeInTheDocument();

    recover();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(
      await screen.findByRole("button", { name: /Escherichia coli/ }),
    ).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the failure, not the required message, once the list closes", async () => {
    failUntilRecovered();
    const user = userEvent.setup();
    render(<TaxIDSelector required />, { wrapper: createQueryClientWrapper() });

    await user.type(screen.getByRole("textbox"), "562");
    await screen.findByRole("alert");
    await user.tab();

    // The list closes 200 ms after blur; the failure stays, under the field.
    expect(
      await screen.findByRole("button", { name: "Show suggestions" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(shownOutage);
    expect(screen.queryByText("NCBI Tax ID is required.")).toBeNull();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  it("shows the form's field error under the input, replaced by a failed search", async () => {
    failUntilRecovered();
    const user = userEvent.setup();
    render(<TaxIDSelector fieldError="Taxonomy ID is required" />, {
      wrapper: createQueryClientWrapper(),
    });

    expect(screen.getByText("Taxonomy ID is required")).toBeVisible();
    expect(screen.getByRole("textbox")).toHaveClass("border-destructive");

    await user.type(screen.getByRole("textbox"), "562");
    await screen.findByRole("alert");

    expect(screen.queryByText("Taxonomy ID is required")).toBeNull();
  });
});
