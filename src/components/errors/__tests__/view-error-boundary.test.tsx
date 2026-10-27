import { render, screen } from "@testing-library/react";

import {
  routeErrorMessage,
  serverFailureCopy,
  ViewErrorBoundary,
} from "../view-error-boundary";

describe("routeErrorMessage", () => {
  it("replaces a digested (server) error's message with the fixed copy", () => {
    const error = Object.assign(new Error("upstream said: secret detail"), {
      digest: "123",
    });
    expect(routeErrorMessage(error, "fixed")).toBe("fixed");
  });

  it("replaces React's redaction text even when no digest came with it", () => {
    expect(
      routeErrorMessage(
        new Error("An error occurred in the Server Components render."),
        "fixed",
      ),
    ).toBe("fixed");
    expect(routeErrorMessage(new Error("Minified React error #441"), "fixed")).toBe(
      "fixed",
    );
  });

  it("keeps and condenses a client error's own message", () => {
    expect(routeErrorMessage(new Error("Row 12 is malformed"), "fixed")).toBe(
      "Row 12 is malformed",
    );
    const condensed = routeErrorMessage(new Error("y".repeat(1000)), "fixed");
    expect(condensed.length).toBeLessThan(1000);
    expect(routeErrorMessage(new Error(""), "fixed")).toBe("fixed");
  });
});

describe("ViewErrorBoundary", () => {
  it("is an announced alert with a heading, Retry and the way back", () => {
    render(
      <ViewErrorBoundary
        error={Object.assign(new Error("redacted"), { digest: "42" })}
        reset={vi.fn()}
        retry={vi.fn()}
        title="Genome view could not be loaded"
        backHref="/genome"
        backLabel="Browse genomes"
      />,
    );

    const alert = screen.getByRole("alert");
    expect(
      screen.getByRole("heading", { level: 1, name: "Genome view could not be loaded" }),
    ).toBeInTheDocument();
    expect(alert).toHaveTextContent(serverFailureCopy);
    expect(alert).toHaveTextContent("Reference: 42");
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Browse genomes" })).toHaveAttribute(
      "href",
      "/genome",
    );
  });

  it("shows only the description when told to hide the message", () => {
    render(
      <ViewErrorBoundary
        error={new Error("token abc-123 rejected")}
        reset={vi.fn()}
        retry={vi.fn()}
        title="View could not be loaded"
        description="Something went wrong."
        hideMessage
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong.");
    expect(screen.queryByText(/abc-123/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
