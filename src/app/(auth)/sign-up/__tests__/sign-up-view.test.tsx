import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import { SignupView } from "../sign-up-view";

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

const outageMessage =
  "The BV-BRC registration service did not respond (timed out after 15 s).";

async function fillSignupForm() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("John"), "Alice");
  await user.type(screen.getByPlaceholderText("Doe"), "Example");
  await user.type(screen.getByPlaceholderText("john.doe"), "alice");
  await user.type(
    screen.getByPlaceholderText("john.doe@example.com"),
    "alice@example.org",
  );
  for (const input of screen.getAllByPlaceholderText("Enter a password")) {
    await user.type(input, "correct-horse");
  }
  return user;
}

describe("SignupView", () => {
  beforeEach(() => {
    searchParamsRef.current = new URLSearchParams();
    scrollIntoView.mockClear();
    server.use(
      http.post("*/api/auth/sign-up/email", () =>
        HttpResponse.json(
          { error: outageMessage, code: "service_unavailable" },
          { status: 504 },
        ),
      ),
    );
  });

  it("reports the empty fields inline, with no native validation bubble", async () => {
    render(<SignupView />, { wrapper: createQueryClientWrapper() });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("First name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Username is required")).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 8 characters long"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }).closest("form"),
    ).toHaveAttribute("novalidate");
  });

  it("brings a failed sign-up's error into view and focuses it", async () => {
    render(<SignupView />, { wrapper: createQueryClientWrapper() });
    const user = await fillSignupForm();

    await user.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(outageMessage);
    expect(alert).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    expect(scrollIntoView.mock.contexts).toContain(alert);
    expect(screen.getByPlaceholderText("john.doe")).toHaveValue("alice");
  });

  it("brings the error back into view when the same failure repeats", async () => {
    render(<SignupView />, { wrapper: createQueryClientWrapper() });
    const user = await fillSignupForm();
    const submit = screen.getByRole("button", { name: "Create account" });

    await user.click(submit);
    expect(await screen.findByRole("alert")).toHaveFocus();

    await user.click(submit);
    await vi.waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("keeps the usual description and a bare sign-in link without a redirect", () => {
    render(<SignupView />, { wrapper: createQueryClientWrapper() });

    expect(
      screen.getByText("Enter your information to create your account"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  it("names what the user was opening and carries the redirect to sign-in", () => {
    searchParamsRef.current = new URLSearchParams({
      redirect: "/workspace/home/Genome%20Groups",
    });
    render(<SignupView />, { wrapper: createQueryClientWrapper() });

    expect(
      screen.getByText(
        "To access your Genome Groups, you must sign in or create an account.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Enter your information to create your account"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?redirect=/workspace/home/Genome%2520Groups",
    );
  });
});
