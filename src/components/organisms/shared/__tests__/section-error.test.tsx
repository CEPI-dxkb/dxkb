import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { maxUserFacingErrorMessageLength } from "@/lib/utils";

import { SectionError } from "../section-error";
import { withSectionError } from "../with-section-error";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => {
  refresh.mockClear();
});

describe("SectionError", () => {
  it("announces the original message as text, not preformatted source", () => {
    render(<SectionError error={new Error("BV-BRC overloaded, try again")} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Section unavailable");
    const message = screen.getByTestId("section-error-message");
    expect(message.tagName).toBe("P");
    expect(message).toHaveTextContent("BV-BRC overloaded, try again");
  });

  it("condenses a long message instead of replacing it", () => {
    const long = `genome host facet: ${"x".repeat(600)}`;
    render(<SectionError error={new Error(long)} />);

    const text = screen.getByTestId("section-error-message").textContent;
    expect(text.startsWith("genome host facet: xxx")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(
      maxUserFacingErrorMessageLength + 1,
    );
  });

  it("accepts a plain message", () => {
    render(<SectionError error="The tree reference is invalid." />);

    expect(screen.getByTestId("section-error-message")).toHaveTextContent(
      "The tree reference is invalid.",
    );
  });

  it("falls back to a sentence for an error that says nothing", () => {
    render(<SectionError error={undefined} />);

    expect(screen.getByTestId("section-error-message")).toHaveTextContent(
      "This section could not be loaded. Please try again.",
    );
  });

  it("refreshes the route on Retry by default, re-running a server section", async () => {
    render(<SectionError error={new Error("boom")} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("calls the caller's retry instead of refreshing when given one", () => {
    const onRetry = vi.fn<() => void>();
    render(<SectionError error={new Error("boom")} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says it is retrying while the caller's load runs again", () => {
    render(
      <SectionError
        error={new Error("boom")}
        onRetry={vi.fn<() => void>()}
        isRetrying
      />,
    );

    expect(screen.getByRole("button", { name: "Retrying…" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("leaves Retry out when loading again cannot help", () => {
    render(<SectionError error="Invalid reference." onRetry={false} />);

    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("withSectionError", () => {
  it("renders the section when its load succeeds", async () => {
    render(await withSectionError(() => Promise.resolve(<p>Loaded</p>)));

    expect(screen.getByText("Loaded")).toBeInTheDocument();
  });

  it("renders the failure with Retry instead of throwing it", async () => {
    render(
      await withSectionError(() =>
        Promise.reject(
          new Error(
            "genome isolation_country facet: 503 Service Unavailable: Site Maintenance",
          ),
        ),
      ),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "genome isolation_country facet: 503 Service Unavailable: Site Maintenance",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
