import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AuthUser } from "@/lib/auth/types";
import { AuthBoundary } from "@/lib/auth/provider";
import { SessionUnverifiedBanner } from "../session-unverified-banner";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

const unverifiedUser: AuthUser = {
  id: "alice@patricbrc.org",
  username: "alice@patricbrc.org",
  email: "",
  realm: "patricbrc.org",
  roles: [],
  sessionUnverified: true,
  sessionUnverifiedReason: "The account service is unavailable (HTTP 503).",
};

const verifiedUser: AuthUser = {
  id: "alice@patricbrc.org",
  username: "alice",
  email: "alice@example.com",
};

function outageNotice() {
  return screen.queryByRole("status", { name: /couldn.t verify your account/i });
}

describe("SessionUnverifiedBanner", () => {
  it("explains the outage for a session the profile service could not verify", () => {
    render(
      <AuthBoundary user={unverifiedUser}>
        <SessionUnverifiedBanner />
      </AuthBoundary>,
    );

    expect(outageNotice()).toHaveTextContent(
      "The account service is unavailable (HTTP 503).",
    );
    expect(outageNotice()).toHaveTextContent(/still signed in/i);
  });

  it.each([
    ["a verified user", verifiedUser],
    ["a signed-out visitor", null],
  ])("stays hidden for %s", (_name, user) => {
    render(
      <AuthBoundary user={user}>
        <SessionUnverifiedBanner />
      </AuthBoundary>,
    );

    expect(outageNotice()).not.toBeInTheDocument();
  });

  it("re-checks the session on Retry", async () => {
    render(
      <AuthBoundary user={unverifiedUser}>
        <SessionUnverifiedBanner />
      </AuthBoundary>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("stays dismissed when a later page mounts the navbar again", async () => {
    const { rerender } = render(
      <AuthBoundary user={unverifiedUser}>
        <SessionUnverifiedBanner key="first-page" />
      </AuthBoundary>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(outageNotice()).not.toBeInTheDocument();

    rerender(
      <AuthBoundary user={unverifiedUser}>
        <SessionUnverifiedBanner key="second-page" />
      </AuthBoundary>,
    );
    expect(outageNotice()).not.toBeInTheDocument();
  });
});
