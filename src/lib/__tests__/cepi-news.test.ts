import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MockInstance } from "vitest";
import { http, HttpResponse } from "msw";
import { fetchCepiNews, getSharedCepiNews, parseCepiNews } from "@/lib/cepi-news";
import { server } from "@/test-helpers/msw-server";
import { settleBackgroundWork } from "@/test-helpers/settle";

const fixture = readFileSync(join(__dirname, "fixtures", "cepi-news.fixture.html"), "utf8");

describe("parseCepiNews", () => {
  it("excludes non-news content types (blogs/articles)", () => {
    const items = parseCepiNews(fixture, 10);
    expect(items.some((i) => i.url.includes("a-blog-post-excluded"))).toBe(false);
    expect(items.every((i) => i.title.length > 0)).toBe(true);
  });

  it("sorts by date descending (newest first)", () => {
    const items = parseCepiNews(fixture, 10);
    const dates = items.map((i) => i.date);
    expect(dates).toEqual([...dates].sort((a, b) => b.localeCompare(a)));
    expect(items[0].date).toBe("2026-07-13");
  });

  it("dedupes by url", () => {
    const items = parseCepiNews(fixture, 10);
    const older = items.filter((i) => i.url.endsWith("/older-news-story"));
    expect(older).toHaveLength(1);
  });

  it("respects the limit", () => {
    expect(parseCepiNews(fixture, 2)).toHaveLength(2);
  });

  it("builds absolute, URL-encoded image URLs", () => {
    const [newest] = parseCepiNews(fixture, 1);
    expect(newest.image).toBe(
      "https://static.cepi.net/images/800x600/2026-07/Photo%20With%20Spaces%20(final).jpg",
    );
  });

  it("builds absolute article URLs and decodes HTML entities", () => {
    const [newest] = parseCepiNews(fixture, 1);
    expect(newest.url).toBe("https://cepi.net/newest-story-undruggable-targets");
    expect(newest.title).toBe('Newest story about "undruggable" targets');
    expect(newest.description).toBe("A summary with an & ampersand and an 'apostrophe'.");
  });

  it("returns an empty array when nothing parses", () => {
    expect(parseCepiNews("<html><body>no data here</body></html>")).toEqual([]);
  });
});

describe("getSharedCepiNews", () => {
  const newsUrl = "https://cepi.net/news";

  afterEach(() => {
    vi.useRealTimers();
  });

  function serveNews(respond: () => Response): () => number {
    let requests = 0;
    server.use(
      http.get(newsUrl, () => {
        requests += 1;
        return respond();
      }),
    );
    return () => requests;
  }

  it("retries an empty result after 5 min", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let healthy = false;
    const requests = serveNews(() =>
      healthy ? HttpResponse.html(fixture) : new HttpResponse(null, { status: 503 }),
    );

    expect(await getSharedCepiNews(3)).toEqual([]);
    healthy = true;
    vi.setSystemTime(Date.now() + 299_000);
    expect(await getSharedCepiNews(3)).toEqual([]);
    await settleBackgroundWork();
    expect(await getSharedCepiNews(3)).toEqual([]);
    expect(requests()).toBe(1);

    vi.setSystemTime(Date.now() + 2000);
    expect(await getSharedCepiNews(3)).toEqual([]);
    await vi.waitFor(async () => {
      expect(await getSharedCepiNews(3)).toHaveLength(3);
    });
    expect(requests()).toBe(2);
  });

  it("keeps a good list over a failed refresh", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    let healthy = true;
    const requests = serveNews(() =>
      healthy ? HttpResponse.html(fixture) : new HttpResponse(null, { status: 503 }),
    );

    const first = await getSharedCepiNews(3);
    expect(first).toHaveLength(3);
    healthy = false;
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    await getSharedCepiNews(3);
    await vi.waitFor(() => {
      expect(requests()).toBe(2);
    });
    // Let the background refresh settle so a dropped list would be served.
    await settleBackgroundWork();
    await expect(getSharedCepiNews(3)).resolves.toEqual(first);
  });

  it("shares one fetch between concurrent callers", async () => {
    const requests = serveNews(() => HttpResponse.html(fixture));

    const [a, b] = await Promise.all([getSharedCepiNews(3), getSharedCepiNews(3)]);

    expect(a).toEqual(b);
    expect(requests()).toBe(1);
  });
});

describe("fetchCepiNews logging", () => {
  const newsUrl = "https://cepi.net/news";
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    vi.useRealTimers();
  });

  it("logs a non-OK response with its status and URL", async () => {
    server.use(http.get(newsUrl, () => new HttpResponse(null, { status: 503 })));

    await expect(fetchCepiNews(3)).resolves.toEqual([]);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith("CEPI news fetch failed:", 503, newsUrl);
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs a thrown error", async () => {
    server.use(http.get(newsUrl, () => HttpResponse.error()));

    await expect(fetchCepiNews(3)).resolves.toEqual([]);

    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith("CEPI news fetch failed:", expect.any(Error));
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when a 200 page yields no news items", async () => {
    server.use(http.get(newsUrl, () => HttpResponse.html("<html><body>nothing</body></html>")));

    await expect(fetchCepiNews(3)).resolves.toEqual([]);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      `CEPI news page yielded no news items (${newsUrl}); its layout may have changed`,
    );
    expect(console.error).not.toHaveBeenCalled();
  });

  it("logs nothing for a good page", async () => {
    server.use(http.get(newsUrl, () => HttpResponse.html(fixture)));

    await expect(fetchCepiNews(3)).resolves.toHaveLength(3);

    expect(console.error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it("does not log a cached empty list again before its 5 min retry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    server.use(http.get(newsUrl, () => new HttpResponse(null, { status: 502 })));

    expect(await getSharedCepiNews(7)).toEqual([]);
    expect(console.error).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 299_000);
    expect(await getSharedCepiNews(7)).toEqual([]);
    await settleBackgroundWork();
    expect(console.error).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 2000);
    await getSharedCepiNews(7);
    await vi.waitFor(() => {
      expect(console.error).toHaveBeenCalledTimes(2);
    });
  });
});
