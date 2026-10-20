import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import { SigninView } from "../sign-in-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom does not lay out, so it has no scrollIntoView.
const scrollIntoView = vi.fn();
Element.prototype.scrollIntoView = scrollIntoView;

describe("SigninView", () => {
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
});
