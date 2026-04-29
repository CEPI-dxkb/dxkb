const { mockAuthAdmin } = vi.hoisted(() => ({
  mockAuthAdmin: { signIn: vi.fn() },
}));

vi.mock("@/lib/auth/server/instance", () => ({
  authAdmin: mockAuthAdmin,
}));

import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

const fakeUser = {
  id: "u1",
  username: "alice",
  email: "alice@example.com",
  first_name: "Alice",
  last_name: "Tester",
  email_verified: true,
  realm: "bvbrc",
  token: "",
};

describe("POST /api/auth/sign-in/email", () => {
  beforeEach(() => {
    mockAuthAdmin.signIn.mockReset();
  });

  it("forwards credentials to authAdmin.signIn and returns session envelope on success", async () => {
    mockAuthAdmin.signIn.mockResolvedValue({ data: fakeUser, error: null });

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice", password: "password1234" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockAuthAdmin.signIn).toHaveBeenCalledWith({
      username: "alice",
      password: "password1234",
    });
    // fakeUser is fully known, so assert exact equality on the user payload.
    expect(data.user).toEqual(fakeUser);
    expect(data.session).toHaveProperty("expiresAt");
    // token in the envelope is always "" (actual token is set via cookie)
    expect(data.session.token).toBe("");
  });

  it("maps invalid_credentials to 401", async () => {
    mockAuthAdmin.signIn.mockResolvedValue({
      data: null,
      error: {
        code: "invalid_credentials",
        message: "Invalid username or password",
      },
    });

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice", password: "wrong" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.message).toBe("Invalid username or password");
  });

  it("uses error.status when provided, overriding the code-based mapping", async () => {
    mockAuthAdmin.signIn.mockResolvedValue({
      data: null,
      error: {
        code: "service_unavailable", // would map to 503 without explicit status
        message: "Upstream is on fire",
        status: 502,
      },
    });

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice", password: "password1234" },
    });
    const response = await POST(request);

    expect(response.status).toBe(502);
  });

  it("maps service_unavailable to 503 when no explicit status is set", async () => {
    mockAuthAdmin.signIn.mockResolvedValue({
      data: null,
      error: {
        code: "service_unavailable",
        message: "Auth service is down",
      },
    });

    const request = mockNextRequest({
      method: "POST",
      body: { username: "alice", password: "password1234" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.message).toBe("Auth service is down");
  });
});
