vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock("@/app/api/auth/utils", () => ({
  clearBvbrcAuthCookies: vi.fn(),
}));

import { POST } from "../route";
import { clearBvbrcAuthCookies } from "@/app/api/auth/utils";

const mockClearBvbrcAuthCookies = vi.mocked(clearBvbrcAuthCookies);

describe("POST /api/auth/sign-out", () => {
  it("calls clearBvbrcAuthCookies", async () => {
    await POST();

    expect(mockClearBvbrcAuthCookies).toHaveBeenCalledTimes(1);
  });

  it("returns success true on successful sign out", async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it("returns 500 when clearBvbrcAuthCookies throws", async () => {
    mockClearBvbrcAuthCookies.mockRejectedValue(new Error("Cookie error"));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Failed to sign out");
  });
});
