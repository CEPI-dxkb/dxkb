import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import { SigninView } from "../sign-in-view";

const searchParamsRef = vi.hoisted(() => ({
  current: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => searchParamsRef.current,
}));

// jsdom does not lay out, so it has no scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

describe("SigninView", () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
  });

  it("reports every empty field inline, with no native validation bubble", async () => {
    render(<SigninView />, { wrapper: createQueryClientWrapper() });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByText("Username is required")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign In" }).closest("form"),
    ).toHaveAttribute("novalidate");
  });

  it("shows and focuses the route's error when sign-in fails", async () => {
    const message =
      "The BV-BRC authentication service did not respond (timed out after 15 s).";
    server.use(
      http.post("*/api/auth/sign-in/email", () =>
        HttpResponse.json(
          { error: message, code: "service_unavailable" },
          { status: 504 },
        ),
      ),
    );
    render(<SigninView />, { wrapper: createQueryClientWrapper() });
    const user = userEvent.setup();

    await user.type(
      screen.getByPlaceholderText("Enter your username or email"),
      "alice",
    );
    await user.type(screen.getByPlaceholderText("Enter your password"), "pw");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveFocus();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeEnabled();
  });

  it("keeps the usual description and a bare sign-up link without a redirect", () => {
    render(<SigninView />, { wrapper: createQueryClientWrapper() });

    expect(
      screen.getByText("Enter your DXKB credentials to access your workspace"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sign up on DXKB" }),
    ).toHaveAttribute("href", "/sign-up");
  });

  it("names what the user was opening and carries the redirect to sign-up", () => {
    searchParamsRef.current = new URLSearchParams({
      redirect: "/services/blast",
    });
    render(<SigninView />, { wrapper: createQueryClientWrapper() });

    expect(
      screen.getByText(
        "To access the BLAST service, you must sign in or create an account.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Enter your DXKB credentials to access your workspace",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sign up on DXKB" }),
    ).toHaveAttribute("href", "/sign-up?redirect=/services/blast");
  });

  it("names a workspace folder the way the Workspace menu does", () => {
    searchParamsRef.current = new URLSearchParams({
      redirect: "/workspace/home/Genome%20Groups",
    });
    render(<SigninView />, { wrapper: createQueryClientWrapper() });

    expect(
      screen.getByText(
        "To access your Genome Groups, you must sign in or create an account.",
      ),
    ).toBeInTheDocument();
  });

  it("falls back to a generic sentence for a page it has no name for", () => {
    searchParamsRef.current = new URLSearchParams({
      redirect: "/taxonomy/2955291?tab=strains",
    });
    render(<SigninView />, { wrapper: createQueryClientWrapper() });

    expect(
      screen.getByText("To continue, you must sign in or create an account."),
    ).toBeInTheDocument();
  });
});
