const { mockAuthAdmin } = vi.hoisted(() => ({
  mockAuthAdmin: { signUp: vi.fn() },
}));

vi.mock("@/lib/auth/server/instance", () => ({
  authAdmin: mockAuthAdmin,
}));

import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

const fakeUser = {
  id: "u2",
  username: "bob",
  email: "bob@example.com",
  first_name: "Bob",
  last_name: "Builder",
  email_verified: false,
  realm: "bvbrc",
  token: "",
};

const signupBody = {
  username: "bob",
  email: "bob@example.com",
  password: "securePass1!",
  first_name: "Bob",
  last_name: "Builder",
};

describe("POST /api/auth/sign-up/email", () => {
  beforeEach(() => {
    mockAuthAdmin.signUp.mockReset();
  });

  it("forwards signup credentials to authAdmin.signUp and returns session envelope on success", async () => {
    mockAuthAdmin.signUp.mockResolvedValue({ data: fakeUser, error: null });

    const request = mockNextRequest({ method: "POST", body: signupBody });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockAuthAdmin.signUp).toHaveBeenCalledWith(signupBody);
    // fakeUser is fully known, so assert exact equality on the user payload.
    expect(data.user).toEqual(fakeUser);
    expect(data.session).toHaveProperty("expiresAt");
    // token in the envelope is always "" (actual token is set via cookie)
    expect(data.session.token).toBe("");
  });

  it("maps conflict to 409 with the error message", async () => {
    mockAuthAdmin.signUp.mockResolvedValue({
      data: null,
      error: { code: "conflict", message: "Username already taken" },
    });

    const request = mockNextRequest({ method: "POST", body: signupBody });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.message).toBe("Username already taken");
  });

  it("returns 500 with error shape when an uncaught exception occurs (withErrorHandling)", async () => {
    mockAuthAdmin.signUp.mockRejectedValue(new Error("Unexpected explosion"));

    const request = mockNextRequest({ method: "POST", body: signupBody });
    const response = await POST(request);
    const data = await response.json();

    // withErrorHandling (toResponse) catches the exception and returns 500
    expect(response.status).toBe(500);
    // errorResponse shapes an Error as { error, code }
    expect(data.error).toBe("Unexpected explosion");
  });
});
