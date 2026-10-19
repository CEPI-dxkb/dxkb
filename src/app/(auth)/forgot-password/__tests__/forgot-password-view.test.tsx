import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/react";

import { ForgotPasswordView } from "../forgot-password-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

async function submitResetRequest() {
  render(<ForgotPasswordView />, { wrapper: createQueryClientWrapper() });
  const user = userEvent.setup();
  await user.type(
    screen.getByPlaceholderText("Enter your username or email"),
    "someone@example.org",
  );
  await user.click(screen.getByRole("button", { name: "Send reset link" }));
}

describe("ForgotPasswordView", () => {
  it("shows the route's error message instead of a generic one", async () => {
    server.use(
      http.post("*/api/auth/forget-password", () =>
        HttpResponse.json(
          { error: "Password reset service unavailable timed out", code: "upstream" },
          { status: 504 },
        ),
      ),
    );

    await submitResetRequest();

    expect(
      await screen.findByText("Password reset service unavailable timed out"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/unexpected error occurred/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });

  it("falls back to a reset-specific message when the failure has no text", async () => {
    server.use(
      http.post("*/api/auth/forget-password", () =>
        HttpResponse.json({ error: "" }, { status: 500 }),
      ),
    );

    await submitResetRequest();

    expect(
      await screen.findByText("Password reset request failed. Please try again."),
    ).toBeInTheDocument();
  });
});
