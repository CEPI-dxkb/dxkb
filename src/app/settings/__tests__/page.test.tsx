import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createElement, type ReactNode } from "react";

import { AuthBoundary } from "@/lib/auth/provider";
import type { AuthUser, UserProfile } from "@/lib/auth/types";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper, testAuthUser } from "@/test-helpers/react";

import SettingsPage from "../page";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: vi.fn(), replace: vi.fn() }),
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

const unverifiedUser: AuthUser = {
  ...testAuthUser,
  sessionUnverified: true,
  sessionUnverifiedReason: "The account service did not answer.",
};

/** The profile endpoint: a 503 first, then the profile. */
function failOnceThenServeProfile(): { calls: () => number } {
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
  return { calls: () => calls };
}

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
    const endpoint = failOnceThenServeProfile();
    renderPage(unverifiedUser);

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
    expect(endpoint.calls()).toBe(2);
  });

  // The root layout's lookup feeds `<AuthBoundary>`, which a client refetch
  // does not reach: the outage banner and the account menu need the refresh.
  it("re-checks an unverified session once a Retry loads the profile", async () => {
    failOnceThenServeProfile();
    renderPage(unverifiedUser);

    await userEvent.setup().click(
      await screen.findByRole("button", { name: "Retry" }),
    );

    expect(
      await screen.findByText("Profile form for alice"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(refreshMock).toHaveBeenCalledOnce();
    });
  });

  it("does not refresh a verified session after a Retry", async () => {
    const endpoint = failOnceThenServeProfile();
    renderPage();

    await userEvent.setup().click(
      await screen.findByRole("button", { name: "Retry" }),
    );

    expect(
      await screen.findByText("Profile form for alice"),
    ).toBeInTheDocument();
    expect(endpoint.calls()).toBe(2);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("keeps the failure up, retrying, until the Retry answers", async () => {
    server.use(
      http.get("*/api/auth/profile", () =>
        HttpResponse.json(
          { error: outage, code: "service_unavailable" },
          { status: 503 },
        ),
      ),
    );
    renderPage(unverifiedUser);

    const alert = await screen.findByRole("alert");
    let releaseRetry: () => void = () => undefined;
    server.use(
      http.get("*/api/auth/profile", async () => {
        await new Promise<void>((resolve) => {
          releaseRetry = resolve;
        });
        return HttpResponse.json(profile);
      }),
    );
    await userEvent.setup().click(
      within(alert).getByRole("button", { name: "Retry" }),
    );

    // The alert, not the loading skeletons, until the retry answers.
    expect(
      await within(alert).findByRole("button", { name: "Retrying…" }),
    ).toBeDisabled();
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(outage);

    act(() => {
      releaseRetry();
    });

    expect(
      await screen.findByText("Profile form for alice"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
