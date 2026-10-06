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

  it("passes the upstream failure through as a 502", async () => {
    bacterialTreeFilename.mockRejectedValue(
      new Error("tree dictionary: 503 Service Unavailable"),
    );

    const response = await GET(request("562"), makeRouteContext({ taxonId: "562" }));

    expect(response.status).toBe(502);
    await expect(json(response)).resolves.toEqual({
      error: "tree dictionary: 503 Service Unavailable",
      code: "upstream_error",
    });
  });
});
