/** CEPI news scraped from cepi.net/news's hydration state (no RSS or API); never throws, returns [] on failure (and logs it). */

import { createSharedCache } from "@/lib/shared-cache";

export interface CepiNewsItem {
  title: string;
  description: string;
  image: string;
  url: string;
  date: string;
}

const cepiOrigin = "https://cepi.net";
const cepiNewsUrl = `${cepiOrigin}/news`;
// Only 800x600 is reliably generated for news card JPGs; other sizes 404 for many images.
const cepiImageBase = "https://static.cepi.net/images/800x600";
const fetchTimeoutMs = 5000;
const revalidateSeconds = 86400;

const itemPattern = /\{"id":\[0,"\d+"\][\s\S]*?"contentType":\[0,"(news|article)"\]/g;

function decodeEntities(html: string): string {
  return html
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function unescape(value: string): string {
  return value.replaceAll('\\"', '"').replaceAll("\\\\", "\\");
}

function stringField(obj: string, key: string): string | undefined {
  const match = new RegExp(`"${key}":\\[0,"((?:[^"\\\\]|\\\\.)*)"\\]`).exec(obj);
  return match ? unescape(match[1]) : undefined;
}

function imageSrc(obj: string): string | undefined {
  const match = /"image":\[0,\{"src":\[0,"((?:[^"\\]|\\.)*)"\]/.exec(obj);
  return match ? unescape(match[1]) : undefined;
}

function toImageUrl(src: string | undefined): string {
  if (!src) return "";
  // Filenames contain spaces and parentheses; encodeURI keeps the path separators.
  return `${cepiImageBase}${encodeURI(src)}`;
}

/** Only `contentType === "news"` items, deduped by URL, newest first; [] if nothing parses. */
export function parseCepiNews(html: string, limit = 4): CepiNewsItem[] {
  const decoded = decodeEntities(html);
  const seen = new Set<string>();
  const items: CepiNewsItem[] = [];

  for (const match of decoded.matchAll(itemPattern)) {
    const obj = match[0];
    if (match[1] !== "news") continue;

    const title = stringField(obj, "title")?.trim();
    const url = stringField(obj, "url");
    if (!title || !url || seen.has(url)) continue;
    seen.add(url);

    items.push({
      title,
      description: stringField(obj, "summary")?.trim() ?? "",
      image: toImageUrl(imageSrc(obj)),
      url: url.startsWith("http") ? url : `${cepiOrigin}${url}`,
      date: stringField(obj, "date") ?? "",
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));
  return items.slice(0, limit);
}

/**
 * Server-only; never throws. The cepi.net fetch stays in Next's data cache for
 * a day (`revalidate`); the news page reads through `getSharedCepiNews`.
 */
export async function fetchCepiNews(limit = 4): Promise<CepiNewsItem[]> {
  try {
    const response = await fetch(cepiNewsUrl, {
      next: { revalidate: revalidateSeconds },
      signal: AbortSignal.timeout(fetchTimeoutMs),
    });
    if (!response.ok) {
      console.error("CEPI news fetch failed:", response.status, cepiNewsUrl);
      return [];
    }
    const html = await response.text();
    const items = parseCepiNews(html, limit);
    if (items.length === 0) {
      console.warn(
        `CEPI news page yielded no news items (${cepiNewsUrl}); its layout may have changed`,
      );
    }
    return items;
  } catch (error) {
    console.error("CEPI news fetch failed:", error);
    return [];
  }
}

// `fetchCepiNews` never throws, so a failure is an empty list, retried after
// 5 min; a failed refresh keeps the list it already had for another hour.
const cepiNewsCache = createSharedCache<number, CepiNewsItem[]>({
  name: "cepi-news",
  load: async (limit, previous) => {
    const items = await fetchCepiNews(limit);
    return items.length === 0 && previous && previous.length > 0 ? previous : items;
  },
  freshMs: (items) => (items.length > 0 ? 60 * 60 * 1000 : 5 * 60 * 1000),
  retryMs: 5 * 60 * 1000,
});

/** `fetchCepiNews` through the process-wide cache, keyed by `limit`. */
export function getSharedCepiNews(limit = 4): Promise<CepiNewsItem[]> {
  return cepiNewsCache.get(limit);
}
