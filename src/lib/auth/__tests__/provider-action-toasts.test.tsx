import { renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { toast } from "sonner";

import {
  AuthBoundary,
  useExitImpersonation,
  useResendVerificationEmail,
} from "@/lib/auth/provider";
import { maintenanceSummary } from "@/test-helpers/upstream-failures";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper, testAuthUser } from "@/test-helpers/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

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

describe("account action toasts", () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
  });

  it("keeps the server's reason when the verification email fails", async () => {
    const reason = `The BV-BRC verification service is unavailable (HTTP 503 Service Unavailable: ${maintenanceSummary}).`;
    server.use(
      http.post("*/api/auth/send-verification-email", () =>
        HttpResponse.json({ error: reason, code: "upstream" }, { status: 503 }),
      ),
    );
    const { result } = renderHook(() => useResendVerificationEmail(), {
      wrapper: wrapper(),
    });

    await result.current();

    expect(toast.error).toHaveBeenCalledWith(
      `Failed to send verification email: ${reason}`,
    );
  });

  it("keeps the browser's reason when the request never reaches the server", async () => {
    server.use(
      http.post("*/api/auth/send-verification-email", () =>
        HttpResponse.error(),
      ),
    );
    const { result } = renderHook(() => useResendVerificationEmail(), {
      wrapper: wrapper(),
    });

    await result.current();

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/^Failed to send verification email: \S/),
    );
  });

  it("keeps the server's reason when exiting impersonation fails", async () => {
    const reason =
      "The BV-BRC authentication service did not respond (timed out after 15 s).";
    server.use(
      http.post("*/api/auth/su-exit", () =>
        HttpResponse.json({ error: reason, code: "upstream" }, { status: 504 }),
      ),
    );
    const { result } = renderHook(() => useExitImpersonation(), {
      wrapper: wrapper(),
    });

    await result.current();

    expect(toast.error).toHaveBeenCalledWith(
      `Failed to exit impersonation: ${reason}`,
    );
  });
});
