const { bacterialTreeFilename } = vi.hoisted(() => ({
  bacterialTreeFilename: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/phylogeny/bacterial-tree-index", () => ({
  bacterialTreeFilename,
}));

import {
  json,
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";

import { GET } from "../route";

function request(taxonId: string) {
  return mockNextRequest({
    url: `http://localhost/api/phylogeny/bacterial-trees/${taxonId}`,
  });
}

describe("GET /api/phylogeny/bacterial-trees/[taxonId]", () => {
  it("returns the taxon's tree filename with a shared cache window", async () => {
    bacterialTreeFilename.mockResolvedValue("Escherichia_561_genus.phyloxml");

    const response = await GET(request("562"), makeRouteContext({ taxonId: "562" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=3600");
    await expect(json(response)).resolves.toEqual({
      filename: "Escherichia_561_genus.phyloxml",
    });
    expect(bacterialTreeFilename).toHaveBeenCalledWith(562);
  });

  it("answers null for a taxon without a tree", async () => {
    bacterialTreeFilename.mockResolvedValue(null);

    const response = await GET(request("2"), makeRouteContext({ taxonId: "2" }));

    expect(response.status).toBe(200);
    await expect(json(response)).resolves.toEqual({ filename: null });
  });

  it.each(["0", "abc", "1.5", "-3", "01"])(
    "rejects taxon id %s without a lookup",
    async (taxonId) => {
      const response = await GET(request(taxonId), makeRouteContext({ taxonId }));

      expect(response.status).toBe(400);
      await expect(json(response)).resolves.toEqual({
        error: "Taxon ID must be a positive integer.",
        code: "invalid_request",
      });
      expect(bacterialTreeFilename).not.toHaveBeenCalled();
    },
  );

  it("answers an upstream failure with a fixed 502 and logs the detail", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("tree dictionary: 503 Service Unavailable");
    bacterialTreeFilename.mockRejectedValue(failure);

    const response = await GET(request("562"), makeRouteContext({ taxonId: "562" }));

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: "Phylogeny tree dictionary is unavailable.",
      code: "upstream_error",
    });
    expect(logged).toHaveBeenCalledWith(
      "phylogeny tree dictionary unavailable",
      failure,
    );
    logged.mockRestore();
  });

  it.each([
    ["an Error with internal detail", new Error("connect ECONNREFUSED 10.0.0.5:443")],
    ["a thrown string", "secret-token-123"],
    ["an undefined rejection", undefined],
  ])("never leaks %s into the 502 body", async (_label, reason) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    bacterialTreeFilename.mockRejectedValue(reason);

    const response = await GET(request("562"), makeRouteContext({ taxonId: "562" }));
    const text = await response.text();

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(text).not.toContain("ECONNREFUSED");
    expect(text).not.toContain("secret-token-123");
    expect(JSON.parse(text)).toEqual({
      error: "Phylogeny tree dictionary is unavailable.",
      code: "upstream_error",
    });
    logged.mockRestore();
  });

  it("does not cache a 400", async () => {
    const response = await GET(request("abc"), makeRouteContext({ taxonId: "abc" }));

    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});
