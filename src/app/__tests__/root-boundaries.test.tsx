import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RootError from "../error";
import GlobalError from "../global-error";
import RootNotFound from "../not-found";

// The navbar and footer read auth, query and theme state; their own tests
// cover them. Here they only need to be present around the boundary.
vi.mock("@/components/navbars/navbar", () => ({
  default: () => <nav aria-label="Main">navbar</nav>,
}));
vi.mock("@/components/footers/footer", () => ({
  default: () => <footer>footer</footer>,
}));
vi.mock("@/components/search/search-bar", () => ({
  SearchBar: () => <input aria-label="Search" />,
}));
vi.mock("../globals.css", () => ({}));

function serverError(): Error & { digest: string } {
  return Object.assign(new Error("<!doctype html><title>Site Maintenance</title>"), {
    digest: "2732112646",
  });
}

describe("root error.tsx", () => {
  it("keeps the navbar and footer, states the failure, and retries the route", async () => {
    const retry = vi.fn();
    const reset = vi.fn();
    render(<RootError error={serverError()} reset={reset} retry={retry} />);

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByText("footer")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(
      within(alert).getByRole("heading", { name: "This page could not be loaded" }),
    ).toBeInTheDocument();
    // Never the redacted (or raw HTML) message; the digest is the reference.
    expect(alert).not.toHaveTextContent("Site Maintenance");
    expect(alert).toHaveTextContent("Reference: 2732112646");
    expect(within(alert).getByRole("link", { name: "Go to the home page" })).toHaveAttribute(
      "href",
      "/",
    );

    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(reset).not.toHaveBeenCalled();
  });
});

describe("global-error.tsx", () => {
  it("renders a standalone document with Retry", async () => {
    const retry = vi.fn();
    // Its own <html>/<body> nest inside the test container (React warns about
    // the nesting, which the suite's console.error stub absorbs).
    render(<GlobalError error={serverError()} reset={vi.fn()} retry={retry} />);

    expect(
      screen.getByRole("heading", { name: "DXKB could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Reference: 2732112646");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("root not-found.tsx", () => {
  it("is an in-shell 404 with search and a link home", () => {
    render(<RootNotFound />);

    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByText("footer")).toBeInTheDocument();
  });
});
