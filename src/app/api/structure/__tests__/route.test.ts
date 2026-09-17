import {
  makeRouteContext,
  mockNextRequest,
} from "@/test-helpers/api-route-helpers";
import { GET } from "../[...path]/route";

function context(path?: string[]) {
  return makeRouteContext({ path });
}

describe("GET /api/structure/[...path]", () => {
  it.each([
    {
      path: ["pdb", "1abc.pdb"],
      upstreamPath: "pdb/1abc.pdb",
    },
    {
      path: ["alphafold", "taxa", "71421", "model.cif.gz"],
      upstreamPath: "alphafold/taxa/71421/model.cif",
    },
  ])(
    "proxies $upstreamPath only to the fixed BV-BRC structure origin",
    async ({ path, upstreamPath }) => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response("ATOM", {
            headers: { "Content-Type": "chemical/x-pdb" },
          }),
        );

      const response = await GET(
        mockNextRequest({ url: "http://localhost/api/structure/test" }),
        context(path),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `https://www.bv-brc.org/structure/${upstreamPath}`,
        {
          cache: "force-cache",
          headers: { "User-Agent": "curl/8.7.1" },
          next: { revalidate: 300 },
        },
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
      expect(response.headers.get("Content-Type")).toBe("chemical/x-pdb");
      expect(response.headers.has("Content-Length")).toBe(false);
      expect(await response.text()).toBe("ATOM");
    },
  );

  it.each<{ path: string[] }>([
    { path: [] },
    { path: ["..", "evil"] },
    { path: ["https://evil.example/model.pdb"] },
  ])("rejects an unsafe path: $path", async ({ path }) => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      mockNextRequest({ url: "http://localhost/api/structure/test" }),
      context(path),
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves an upstream error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404, statusText: "Not Found" }),
    );
    const response = await GET(mockNextRequest(), context(["missing.pdb"]));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "BV-BRC structure request failed: 404 Not Found",
    });
  });

  it("returns 502 when the upstream request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("upstream unavailable"),
    );

    const response = await GET(mockNextRequest(), context(["model.pdb"]));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "upstream unavailable" });
  });
});
