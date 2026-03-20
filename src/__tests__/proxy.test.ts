import { NextRequest } from "next/server";
import { proxy } from "../proxy";

/** Helper to build a NextRequest with optional cookies */
function buildRequest(
  pathname: string,
  cookies?: Record<string, string>,
): NextRequest {
  const url = `http://localhost:3019${pathname}`;
  const request = new NextRequest(url);

  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      request.cookies.set(name, value);
    }
  }

  return request;
}

/** Parse the Location header into a URL, failing the test if missing */
function getRedirectLocation(response: Response): URL {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location as string);
}

const validSession = {
  bvbrc_token: "tok123",
  bvbrc_user_id: "testuser",
};

describe("proxy", () => {
  describe("protected API paths", () => {
    it("returns 401 for /api/protected/ without session cookies", () => {
      const request = buildRequest("/api/protected/some-endpoint");
      const response = proxy(request);
      const data = response.headers.get("content-type");

      expect(response.status).toBe(401);
      expect(data).toContain("application/json");
    });

    it("allows /api/protected/ with valid session cookies", () => {
      const request = buildRequest("/api/protected/some-endpoint", validSession);
      const response = proxy(request);

      // NextResponse.next() returns a 200 with x-middleware-next header
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("returns 401 when only token is present (missing user_id)", () => {
      const request = buildRequest("/api/protected/endpoint", {
        bvbrc_token: "tok",
      });
      const response = proxy(request);

      expect(response.status).toBe(401);
    });

    it("returns 401 when only user_id is present (missing token)", () => {
      const request = buildRequest("/api/protected/endpoint", {
        bvbrc_user_id: "user",
      });
      const response = proxy(request);

      expect(response.status).toBe(401);
    });
  });

  describe("protected page paths", () => {
    it("redirects to /sign-in for /services/ sub-paths without session", () => {
      const request = buildRequest("/services/blast");
      const response = proxy(request);

      expect(response.status).toBe(307);
      const location = getRedirectLocation(response);
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("redirect")).toBe("/services/blast");
    });

    it("redirects to /sign-in for /workspace without session", () => {
      const request = buildRequest("/workspace/user1/home");
      const response = proxy(request);

      expect(response.status).toBe(307);
      const location = getRedirectLocation(response);
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("redirect")).toBe("/workspace/user1/home");
    });

    it("redirects to /sign-in for /jobs without session", () => {
      const request = buildRequest("/jobs");
      const response = proxy(request);

      expect(response.status).toBe(307);
      const location = getRedirectLocation(response);
      expect(location.pathname).toBe("/sign-in");
    });

    it("redirects to /sign-in for /settings without session", () => {
      const request = buildRequest("/settings");
      const response = proxy(request);

      expect(response.status).toBe(307);
      const location = getRedirectLocation(response);
      expect(location.pathname).toBe("/sign-in");
    });

    it("preserves query string in redirect", () => {
      const request = buildRequest("/services/blast?param=value");
      const response = proxy(request);

      expect(response.status).toBe(307);
      const location = getRedirectLocation(response);
      expect(location.searchParams.get("redirect")).toBe("/services/blast?param=value");
    });

    it("allows protected pages with valid session cookies", () => {
      const request = buildRequest("/services/blast", validSession);
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });

  describe("public paths", () => {
    it("allows / without session", () => {
      const request = buildRequest("/");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("allows /search without session", () => {
      const request = buildRequest("/search");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("allows /services index page without session", () => {
      const request = buildRequest("/services");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("allows /api/auth paths without session", () => {
      const request = buildRequest("/api/auth/sign-in");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });
});
