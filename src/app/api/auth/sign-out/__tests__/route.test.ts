vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: vi.fn(), set: vi.fn() })),
}));

vi.mock("@/lib/auth/session", () => ({
  deleteSession: vi.fn(),
}));

import { POST } from "../route";
import { deleteSession } from "@/lib/auth/session";

const mockDeleteSession = vi.mocked(deleteSession);

describe("POST /api/auth/sign-out", () => {
  it("calls deleteSession", async () => {
    await POST();

    expect(mockDeleteSession).toHaveBeenCalledTimes(1);
  });

  it("returns success true on successful sign out", async () => {
    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
  });

  it("returns 500 when deleteSession throws", async () => {
    mockDeleteSession.mockRejectedValue(new Error("Cookie error"));

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.message).toBe("Failed to sign out");
  });
});
