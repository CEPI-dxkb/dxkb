import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { UpstreamError } from "@/lib/api/upstream-failure";
import { maxUserFacingErrorMessageLength } from "@/lib/utils";

import { SectionError } from "../section-error";
import { withSectionError } from "../with-section-error";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  refresh.mockClear();
});

describe("SectionError", () => {
  it("names the section that failed in its title", () => {
    render(
      <SectionError
        section="Reference genomes"
        error={new Error("BV-BRC overloaded, try again")}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Reference genomes could not be loaded");
    expect(alert).not.toHaveTextContent("Section unavailable");
    expect(alert).not.toHaveTextContent("Upstream data could not be loaded");
  });

  it("announces the original message as text, not preformatted source", () => {
    render(<SectionError section="Reference genomes" error={new Error("BV-BRC overloaded, try again")} />);

    const message = screen.getByTestId("section-error-message");
    expect(message.tagName).toBe("P");
    expect(message).toHaveTextContent("BV-BRC overloaded, try again");
  });

  it("condenses a long message instead of replacing it", () => {
    const long = `genome host facet: ${"x".repeat(600)}`;
    render(<SectionError section="Reference genomes" error={new Error(long)} />);

    const text = screen.getByTestId("section-error-message").textContent;
    expect(text.startsWith("genome host facet: xxx")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(
      maxUserFacingErrorMessageLength + 1,
    );
  });

  it("accepts a plain message", () => {
    render(<SectionError section="Reference genomes" error="The tree reference is invalid." />);

    expect(screen.getByTestId("section-error-message")).toHaveTextContent(
      "The tree reference is invalid.",
    );
  });

  it("falls back to a sentence for an error that says nothing", () => {
    render(<SectionError section="Reference genomes" error={undefined} />);

    expect(screen.getByTestId("section-error-message")).toHaveTextContent(
      "This section could not be loaded. Please try again.",
    );
  });

  it("refreshes the route on Retry by default, re-running a server section", async () => {
    render(<SectionError section="Reference genomes" error={new Error("boom")} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("calls the caller's retry instead of refreshing when given one", () => {
    const onRetry = vi.fn<() => void>();
    render(<SectionError section="Reference genomes" error={new Error("boom")} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says it is retrying while the caller's load runs again", () => {
    render(
      <SectionError
        section="Reference genomes"
        error={new Error("boom")}
        onRetry={vi.fn<() => void>()}
        isRetrying
      />,
    );

    const button = screen.getByRole("button", { name: "Retrying…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
  });

  it("leaves Retry out when loading again cannot help", () => {
    render(<SectionError section="Reference genomes" error="Invalid reference." onRetry={false} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("withSectionError", () => {
  it("renders the section when its load succeeds", async () => {
    render(
      await withSectionError("Top genera", () =>
        Promise.resolve(<p>Loaded</p>),
      ),
    );

    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });

  it("renders the failure, titled with the section, with Retry instead of throwing it", async () => {
    render(
      await withSectionError("Metadata distributions", () =>
        Promise.reject(
          new Error("Isolation Country: 503 Service Unavailable: Site Maintenance"),
        ),
      ),
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Metadata distributions could not be loaded");
    expect(alert).toHaveTextContent(
      "Isolation Country: 503 Service Unavailable: Site Maintenance",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("logs the caught error with its host, which the user's message leaves out", async () => {
    const logged = vi.mocked(console.error);
    logged.mockClear();
    const outage = new UpstreamError({
      status: 503,
      code: "service_unavailable",
      message:
        "The BV-BRC data service is unavailable (HTTP 503 Service Unavailable).",
      host: "www.bv-brc.org",
    });

    render(await withSectionError("Reference genomes", () => Promise.reject(outage)));

    expect(screen.getByRole("alert")).not.toHaveTextContent("www.bv-brc.org");
    expect(logged).toHaveBeenCalledWith(
      "[overview] Reference genomes could not be loaded:",
      outage,
    );
    expect(outage.host).toBe("www.bv-brc.org");
  });

  // In development React sends every server component's props to the browser,
  // and it cannot revive an error whose cause has no stack frame outside Node
  // internals (a budget's TimeoutError, undici's socket error): the browser
  // throws "frame.join is not a function" and the route's error boundary
  // replaces the whole page.
  it("hands SectionError the message, never the error and its causes", async () => {
    const outage = new UpstreamError(
      {
        status: 504,
        code: "upstream_timeout",
        message: "The BV-BRC data service did not respond (timed out after 30 s).",
      },
      { cause: new DOMException("The operation was aborted due to timeout", "TimeoutError") },
    );

    const element = await withSectionError("Data summary", () => Promise.reject(outage));

    expect(element.props).toEqual(
      expect.objectContaining({
        error: "The BV-BRC data service did not respond (timed out after 30 s).",
      }),
    );
    render(element);
    expect(screen.getByTestId("section-error-message")).toHaveTextContent(
      "The BV-BRC data service did not respond (timed out after 30 s).",
    );
  });

  it("keeps the fallback copy for a failure that says nothing", async () => {
    render(await withSectionError("Top genera", () => Promise.reject(new Error(""))));

    expect(screen.getByTestId("section-error-message")).toHaveTextContent(
      "This section could not be loaded. Please try again.",
    );
  });
});
