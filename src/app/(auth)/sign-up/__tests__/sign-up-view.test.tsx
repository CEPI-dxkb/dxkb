import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import { SignupView } from "../sign-up-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
    // The form keeps what the user typed.
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
});
