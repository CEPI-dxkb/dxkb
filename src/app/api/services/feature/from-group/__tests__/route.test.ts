import { http, HttpResponse } from "msw";

import { server } from "@/test-helpers/msw-server";
import { POST } from "../route";
import { mockNextRequest } from "@/test-helpers/api-route-helpers";

vi.mock("@/lib/auth", () => ({ getBvbrcAuthToken: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getRequiredEnv: vi.fn(() => "http://mock-api"),
}));

async function json(res: Response) {
  return res.json();
}

describe("POST /api/services/feature/from-group", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no auth token", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue(undefined);

    const req = mockNextRequest({
      method: "POST",
      body: { feature_group_path: "/path/to/group" },
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: "Authentication required" }),
    );
  });

  it("returns empty results when feature_group_path is missing", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    const req = mockNextRequest({ method: "POST", body: {} });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("returns empty results when feature_group_path is empty string", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    const req = mockNextRequest({
      method: "POST",
      body: { feature_group_path: "   " },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: [] });
  });

  it("URL encodes the feature group path", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    let capturedUrl: string | undefined;

    server.use(
      http.get("http://mock-api/genome_feature/", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json([]);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { feature_group_path: "/user@bvbrc/home/my group" },
    });
    await POST(req);

    expect(capturedUrl).toContain(
      "FeatureGroup(%2Fuser%40bvbrc%2Fhome%2Fmy%20group)",
    );
  });

  it("returns results on success", async () => {
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    const features = [
      { feature_id: "f1", patric_id: "p1" },
      { feature_id: "f2", patric_id: "p2" },
    ];

    server.use(
      http.get("http://mock-api/genome_feature/", () => {
        return HttpResponse.json(features);
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { feature_group_path: "/user/home/group" },
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ results: features });
  });

  it("returns upstream error on non-ok response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getBvbrcAuthToken } = await import("@/lib/auth");
    vi.mocked(getBvbrcAuthToken).mockResolvedValue("token");

    server.use(
      http.get("http://mock-api/genome_feature/", () => {
        return new HttpResponse("err", { status: 502 });
      }),
    );

    const req = mockNextRequest({
      method: "POST",
      body: { feature_group_path: "/user/home/group" },
    });
    const res = await POST(req);

    expect(res.status).toBe(502);
    expect(await json(res)).toEqual(
      expect.objectContaining({ error: expect.stringContaining("failed") }),
    );
  });
});
