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

    it("writes a readable sign-in redirect", () => {
      const response = proxy(buildRequest("/workspace/user@bvbrc/home?x=a,b"));
      expect(response.headers.get("location")).toBe(
        "http://localhost:3019/sign-in?redirect=/workspace/user@bvbrc/home?x%3Da,b",
      );
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
      ).toBe("/services/blast?query=alpha+beta&filter=a/b");
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

  describe("workspace routes", () => {
    it.each([
      "/workspace/public",
      "/workspace/public/ARWattam@patricbrc.org/BV-BRC%20Workshop",
      "/workspace/public/ntvy@patricbrc.org/2023-NVDDTHD/GD63ONT_DuongQC",
      "/workspace/workshop",
      "/workspace/user@bvbrc/For-Jim/test1_SRR1695593",
      "/workspace/user@bvbrc/home/a/b/c",
    ])("redirects %s to sign-in without session", (path) => {
      const request = buildRequest(path);
      const response = proxy(request);

      expect(response.status).toBe(307);
      const location = getRedirectLocation(response);
      expect(location.pathname).toBe("/sign-in");
      expect(location.searchParams.get("redirect")).toBe(path);
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

    it("keeps RQL readable when rewriting ?view= to ?tab=", () => {
      const response = proxy(
        buildRequest("/genome?rql=eq%28public%2Cfalse%29&view=genomes"),
      );
      expect(response.status).toBe(308);
      expect(getRedirectLocation(response).search).toBe(
        "?rql=eq(public,false)&tab=genomes",
      );
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
    // Next.js re-serializes the query before the proxy runs, so a raw legacy
    // `?eq(genome_status,Complete)` arrives form-encoded. These inputs use that
    // normalized form; the tests above use the raw form a hand-built request keeps.
    it("redirects a normalized list query without double-encoding the RQL", () => {
      const request = buildRequest(
        "/view/GenomeList?eq%28genome_status%2CComplete%29=",
      );
      const response = proxy(request);
      expect(response.status).toBe(308);
      const loc = getRedirectLocation(response);
      expect(loc.pathname).toBe("/genome");
      expect(loc.search).toBe("?rql=eq(genome_status,Complete)");
    });
    it("keeps quoted values and named params from a normalized list query", () => {
      const request = buildRequest(
        "/view/GenomeList?eq%28genome_name%2C%22E+coli%2C+K12%22%29=&keyword=a+b",
      );
      const loc = getRedirectLocation(proxy(request));
      expect(loc.searchParams.get("rql")).toBe('eq(genome_name,"E coli, K12")');
      expect(loc.searchParams.get("keyword")).toBe("a b");
    });
    it("renames the TaxonList lineage field in a normalized list query", () => {
      const request = buildRequest(
        "/view/TaxonList?eq%28taxon_lineage_ids%2C1763%29=",
      );
      const loc = getRedirectLocation(proxy(request));
      expect(loc.pathname).toBe("/taxonomy");
      expect(loc.searchParams.get("rql")).toBe("eq(lineage_ids,1763)");
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
