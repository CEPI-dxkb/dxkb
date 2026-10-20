import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";

import { AuthBoundary } from "@/lib/auth/provider";
import type { AuthUser, UserProfile } from "@/lib/auth/types";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper, testAuthUser } from "@/test-helpers/react";

import SettingsPage from "../page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
// The forms have their own tests; here they only show the page got a profile.
vi.mock("@/components/settings/profile-form", () => ({
  ProfileForm: ({ profile }: { profile: UserProfile }) =>
    createElement("p", null, `Profile form for ${profile.id}`),
}));
vi.mock("@/components/settings/preferences-form", () => ({
  PreferencesForm: () => null,
}));
vi.mock("@/components/settings/password-change-form", () => ({
  PasswordChangeForm: () => null,
}));

const profile: UserProfile = {
  id: "alice",
  l_id: "alice",
  email: "alice@example.org",
  email_verified: true,
  first_name: "Alice",
  last_name: "Example",
  organisms: "",
  creation_date: "2026-01-01T00:00:00Z",
  last_login: "2026-10-01T00:00:00Z",
  reverification: false,
  source: "bvbrc",
  settings: {},
};

const outage =
  "The BV-BRC profile service is unavailable (HTTP 503 Service Unavailable: Site Maintenance).";

function renderPage(user: AuthUser = testAuthUser) {
  const QueryWrapper = createQueryClientWrapper();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <AuthBoundary user={user}>{children}</AuthBoundary>
      </QueryWrapper>
    );
  }
  return render(<SettingsPage />, { wrapper: Wrapper });
}

describe("SettingsPage", () => {
  it("says why the profile did not load and retries on request", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/auth/profile", () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json(
              { error: outage, code: "service_unavailable" },
              { status: 503 },
            )
          : HttpResponse.json(profile);
      }),
    );
    renderPage({
      ...testAuthUser,
      sessionUnverified: true,
      sessionUnverifiedReason: "The account service did not answer.",
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load your profile");
    expect(alert).toHaveTextContent(outage);
    expect(alert).not.toHaveTextContent(/try refreshing the page/i);

    await userEvent.setup().click(
      screen.getByRole("button", { name: "Retry" }),
    );

    expect(
      await screen.findByText("Profile form for alice"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });
});
