import { NextRequest } from "next/server";
import { config, proxy } from "../proxy";
import { viewSegments } from "@/lib/views/view-registry";

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

    it("forwards the complete request URL for authoritative server validation", () => {
      const request = buildRequest(
        "/services/blast?query=alpha%20beta&filter=a%2Fb",
        validSession,
      );
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
      expect(
        response.headers.get("x-middleware-request-x-dxkb-request-path"),
      ).toBe("/services/blast?query=alpha%20beta&filter=a%2Fb");
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

    it("allows /workspace/public without session", () => {
      const request = buildRequest("/workspace/public");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("allows /workspace/public/ sub-paths without session", () => {
      const request = buildRequest("/workspace/public/user@bvbrc/home");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("allows /workspace/workshop without session", () => {
      const request = buildRequest("/workspace/workshop");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("allows /workspace/workshop/ sub-paths without session", () => {
      const request = buildRequest("/workspace/workshop/some-event");
      const response = proxy(request);

      expect(response.headers.get("x-middleware-next")).toBe("1");
    });

    it("does not allow /workspace/publicXYZ without session", () => {
      const request = buildRequest("/workspace/publicXYZ");
      const response = proxy(request);

      expect(response.status).toBe(307);
    });
  });

  describe("view→tab redirect", () => {
    it("redirects ?view= to ?tab= on a (views) route", () => {
      const request = buildRequest("/taxonomy/234?view=genomes");
      const response = proxy(request);
      expect(response.status).toBe(308);
      const loc = getRedirectLocation(response);
      expect(loc.pathname).toBe("/taxonomy/234");
      expect(loc.searchParams.get("tab")).toBe("genomes");
      expect(loc.searchParams.get("view")).toBeNull();
    });

    it("does not redirect ?view= on a non-(views) path", () => {
      const request = buildRequest("/search?view=genomes");
      const response = proxy(request);
      expect(response.status).not.toBe(308);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });

  describe("legacy /view/* redirect", () => {
    it("redirects a singular legacy path", () => {
      const request = buildRequest("/view/Genome/59201.7581");
      const response = proxy(request);
      expect(response.status).toBe(308);
      expect(getRedirectLocation(response).pathname).toBe("/genome/59201.7581");
    });
    it("redirects a list legacy path into ?rql=", () => {
      const request = buildRequest("/view/GenomeList/?eq(taxon_id,1763)");
      const response = proxy(request);
      expect(response.status).toBe(308);
      const loc = getRedirectLocation(response);
      expect(loc.pathname).toBe("/genome");
      expect(loc.searchParams.get("rql")).toBe("eq(taxon_id,1763)");
    });
    it("redirects Protein aliases to Feature routes", () => {
      const member = proxy(buildRequest("/view/Protein/fig%7C83332.12.peg.1"));
      expect(member.status).toBe(308);
      expect(getRedirectLocation(member).pathname).toBe("/feature/fig%7C83332.12.peg.1");

      const list = proxy(buildRequest("/view/ProteinList/?keyword=kinase"));
      expect(list.status).toBe(308);
      expect(getRedirectLocation(list).pathname).toBe("/feature");
      expect(getRedirectLocation(list).searchParams.get("keyword")).toBe("kinase");
      expect(getRedirectLocation(list).searchParams.get("filter")).toBe("protein");
    });

    it("passes through an unknown legacy view name (no redirect)", () => {
      const request = buildRequest("/view/Nonsense/1");
      const response = proxy(request);
      expect(response.status).not.toBe(308);
      expect(response.headers.get("x-middleware-next")).toBe("1");
    });
  });

  // The matcher must stay a static literal (Next.js cannot compute it from
  // viewSegments at runtime), so it is hand-mirrored in proxy.ts. This guard fails
  // when a new registry entry is added without its matcher line — preventing the
  // ?view=→?tab= rewrite from silently skipping the new segment.
  describe("view-segment matcher drift guard", () => {
    it("includes a matcher line for every view segment", () => {
      for (const segment of viewSegments) {
        expect(config.matcher).toContain(`/${segment}/:path*`);
      }
    });
  });
});
