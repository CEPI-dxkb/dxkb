import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";
import { POST } from "../route";

describe("POST /api/auth/forget-password", () => {
  it("returns 400 when no identifier is provided", async () => {
    const request = mockNextRequest({
      method: "POST",
      body: {},
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.message).toBe("Email or username is required");
  });

  it("accepts usernameOrEmail field", async () => {
    let handlerCalled = false;
    server.use(
      http.post("https://user.bv-brc.org/reset", () => {
        handlerCalled = true;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { usernameOrEmail: "testuser" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe("Password reset email sent successfully");
    expect(handlerCalled).toBe(true);
  });

  it("accepts email field as fallback", async () => {
    server.use(
      http.post("https://user.bv-brc.org/reset", () => {
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { email: "test@example.com" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("returns upstream error with message from JSON response", async () => {
    server.use(
      http.post("https://user.bv-brc.org/reset", () => {
        return HttpResponse.json(
          { message: "User not found" },
          { status: 404 },
        );
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { usernameOrEmail: "unknown" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.message).toBe("User not found");
  });

  it("returns default error message when upstream JSON parse fails", async () => {
    server.use(
      http.post("https://user.bv-brc.org/reset", () => {
        return new HttpResponse("not json", { status: 500 });
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { usernameOrEmail: "testuser" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Failed to send password reset email");
  });

  it("returns 503 when an exception is thrown", async () => {
    server.use(
      http.post("https://user.bv-brc.org/reset", () => {
        return HttpResponse.error();
      }),
    );

    const request = mockNextRequest({
      method: "POST",
      body: { usernameOrEmail: "testuser" },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.success).toBe(false);
    expect(data.message).toBe("Password reset service unavailable");
  });
});
