const { mockCookieStore } = vi.hoisted(() => ({
  mockCookieStore: { get: vi.fn(), set: vi.fn() },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}));

import { POST } from "../route";

beforeEach(() => {
  mockCookieStore.get.mockReset();
  mockCookieStore.set.mockReset();
});

describe("POST /api/auth/sign-out", () => {
  it("clears every session and impersonation cookie via cookieSession.clear() and returns { success: true }", async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });

    // cookieSession.clear() expires all session and impersonation cookies. Asserting on
    // the full set ensures a regression that drops one of them (e.g. the vestigial
    // bvbrc_user_profile cookie) trips the test rather than silently leaking session state.
    const clearedNames = mockCookieStore.set.mock.calls.map((call) => call[0]);
    expect(clearedNames).toEqual(
      expect.arrayContaining([
        "bvbrc_token",
        "bvbrc_user_id",
        "bvbrc_realm",
        "bvbrc_user_profile",
        "bvbrc_su_original_token",
        "bvbrc_su_original_user_id",
        "bvbrc_su_original_realm",
      ]),
    );

    // Every cookie write during sign-out must be a clear (maxAge: 0) so the browser
    // expires them immediately. A non-zero maxAge here would mean we accidentally set
    // a value instead of clearing.
    for (const call of mockCookieStore.set.mock.calls) {
      const opts = call[2] as { maxAge?: number };
      expect(opts.maxAge).toBe(0);
    }
  });
});
