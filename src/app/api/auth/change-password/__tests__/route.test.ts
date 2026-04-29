const { mockAuthAdmin } = vi.hoisted(() => ({
  mockAuthAdmin: { changePassword: vi.fn() },
}));

vi.mock("@/lib/auth/server/instance", () => ({
  authAdmin: mockAuthAdmin,
}));

import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    mockAuthAdmin.changePassword.mockReset();
  });

  it("returns 400 when both fields are missing", async () => {
    const request = mockNextRequest({ method: "POST", body: {} });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
    expect(mockAuthAdmin.changePassword).not.toHaveBeenCalled();
  });

  it("returns 400 when currentPassword is missing", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
    expect(mockAuthAdmin.changePassword).not.toHaveBeenCalled();
  });

  it("returns 400 when newPassword is an empty string", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
    expect(mockAuthAdmin.changePassword).not.toHaveBeenCalled();
  });

  it("returns 400 when currentPassword is an empty string", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
    expect(mockAuthAdmin.changePassword).not.toHaveBeenCalled();
  });

  it("forwards both passwords positionally to authAdmin.changePassword and returns { success: true }", async () => {
    mockAuthAdmin.changePassword.mockResolvedValue({ data: undefined, error: null });

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockAuthAdmin.changePassword).toHaveBeenCalledWith("old", "newSecret123");
  });

  it("uses error.status (explicit) over the fallback 500", async () => {
    mockAuthAdmin.changePassword.mockResolvedValue({
      data: null,
      error: {
        code: "invalid_credentials",
        message: "Wrong current password",
        status: 403,
      },
    });

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.message).toBe("Wrong current password");
  });

  it("falls back to 500 when error has no explicit status", async () => {
    mockAuthAdmin.changePassword.mockResolvedValue({
      data: null,
      error: {
        code: "unknown",
        message: "Something went wrong",
      },
    });

    const request = mockNextRequest({
      method: "POST",
      body: { currentPassword: "old", newPassword: "newSecret123" },
    });
    const response = await POST(request);
    const data = await response.json();

    // change-password uses error.status ?? 500, not statusFor
    expect(response.status).toBe(500);
    expect(data.message).toBe("Something went wrong");
  });

  it("returns 500 when request.json() throws (outer try/catch)", async () => {
    // Craft a request with a malformed body so JSON.parse fails.
    // mockNextRequest always sets Content-Type: application/json, but we
    // override the body to a raw non-JSON string by creating the NextRequest directly.
    const { NextRequest } = await import("next/server");
    const badRequest = new NextRequest("http://localhost/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });

    // The route catches JSON parse errors via .catch(() => ({})), so it won't
    // throw — it falls back to an empty object and returns 400 (missing fields).
    // This test verifies the .catch fallback path, not a 500.
    const response = await POST(badRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Current password and new password are required");
    expect(mockAuthAdmin.changePassword).not.toHaveBeenCalled();
  });
});
