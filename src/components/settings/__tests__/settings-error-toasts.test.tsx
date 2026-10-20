import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { PasswordChangeForm } from "@/components/settings/password-change-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { AuthBoundary } from "@/lib/auth/provider";
import type { UserProfile } from "@/lib/auth/types";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper, testAuthUser } from "@/test-helpers/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
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

function wrapper() {
  const QueryWrapper = createQueryClientWrapper();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <AuthBoundary user={testAuthUser}>{children}</AuthBoundary>
      </QueryWrapper>
    );
  };
}

function failWith(path: string, error: string, status = 503) {
  server.use(
    http.post(`*${path}`, () =>
      HttpResponse.json({ error, code: "upstream" }, { status }),
    ),
  );
}

describe("settings save failures", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("names the profile save and keeps the server's reason", async () => {
    failWith("/api/auth/profile", outage);
    render(<ProfileForm profile={profile} />, { wrapper: wrapper() });
    const user = userEvent.setup();

    const firstName = screen.getByLabelText(/First Name/);
    await user.clear(firstName);
    await user.type(firstName, "Crawly");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        `Failed to update profile: ${outage}`,
      );
    });
    expect(firstName).toHaveValue("Crawly");
  });

  it("does not repeat a server message that already names the action", async () => {
    failWith("/api/auth/profile", "Failed to update profile", 400);
    render(<ProfileForm profile={profile} />, { wrapper: wrapper() });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/First Name/), "x");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update profile");
    });
  });

  it("names the password change and keeps the server's reason", async () => {
    const reason =
      "The BV-BRC password service did not respond (timed out after 15 s).";
    failWith("/api/auth/change-password", reason, 504);
    render(<PasswordChangeForm />, { wrapper: wrapper() });
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^Current Password/), "old-password");
    await user.type(screen.getByLabelText(/^New Password/), "new-password");
    await user.type(
      screen.getByLabelText(/^Confirm New Password/),
      "new-password",
    );
    await user.click(screen.getByRole("button", { name: "Change Password" }));

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        `Failed to change password: ${reason}`,
      );
    });
    // Kept, so a retry is one click.
    expect(screen.getByLabelText(/^New Password/)).toHaveValue("new-password");
  });
});
