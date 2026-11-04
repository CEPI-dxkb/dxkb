import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import {
  circularViewerQueryKeys,
  loadCustomTrack,
  loadPresetTrack,
} from "../client";

describe("circular viewer client", () => {
  it("asks the same-origin route for a preset track", async () => {
    let seen: URL | undefined;
    server.use(
      http.get("*/api/circular-viewer/track", ({ request }) => {
        seen = new URL(request.url);
        return HttpResponse.json({ features: [], truncated: false });
      }),
    );
    await expect(loadPresetTrack("83332.12", "amr")).resolves.toEqual({
      features: [],
      truncated: false,
    });
    expect(seen?.searchParams.get("genomeId")).toBe("83332.12");
    expect(seen?.searchParams.get("preset")).toBe("amr");
  });

  it("keeps a keyword's + and spaces intact on the wire", async () => {
    let keyword: string | null = null;
    server.use(
      http.get("*/api/circular-viewer/custom", ({ request }) => {
        keyword = new URL(request.url).searchParams.get("keyword");
        return HttpResponse.json({ features: [], truncated: false });
      }),
    );
    await loadCustomTrack("1.1", {
      type: "CDS",
      strand: "forward",
      keyword: "Na+/H+ antiporter",
    });
    expect(keyword).toBe("Na+/H+ antiporter");
  });

  it("raises the route's error message", async () => {
    server.use(
      http.get("*/api/circular-viewer/track", () =>
        HttpResponse.json(
          {
            error: "The BV-BRC data service is unavailable (HTTP 503).",
            code: "upstream_unavailable",
          },
          { status: 503 },
        ),
      ),
    );
    await expect(loadPresetTrack("1.1", "vf")).rejects.toThrow(
      "The BV-BRC data service is unavailable",
    );
  });

  it("keys custom tracks by their whole query", () => {
    expect(
      circularViewerQueryKeys.custom("1.1", {
        type: "RNA",
        strand: "both",
        keyword: "tRNA",
      }),
    ).toEqual(["circular-viewer", "custom", "1.1", "RNA", "both", "tRNA"]);
  });
});
