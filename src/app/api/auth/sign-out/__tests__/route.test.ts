const { mockAuthAdmin } = vi.hoisted(() => ({
  mockAuthAdmin: { signOut: vi.fn() },
}));

vi.mock("@/lib/auth/server/instance", () => ({
  authAdmin: mockAuthAdmin,
}));

import { POST } from "../route";

describe("POST /api/auth/sign-out", () => {
  beforeEach(() => {
    mockAuthAdmin.signOut.mockReset();
  });

  it("calls authAdmin.signOut and returns { success: true } on success", async () => {
    mockAuthAdmin.signOut.mockResolvedValue({ data: undefined, error: null });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockAuthAdmin.signOut).toHaveBeenCalledOnce();
  });

  it("maps service_unavailable to 503 and forwards the error message", async () => {
    mockAuthAdmin.signOut.mockResolvedValue({
      data: null,
      error: { code: "service_unavailable", message: "Logout endpoint is down" },
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("Logout endpoint is down");
  });

  it("maps unauthorized to 401", async () => {
    mockAuthAdmin.signOut.mockResolvedValue({
      data: null,
      error: { code: "unauthorized", message: "Session expired" },
    });

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Session expired");
  });
});
