import { notFound, redirect } from "next/navigation";
import { recordUnavailableMessage } from "@/components/errors/record-load-failure";
import { DataApiError } from "@/lib/data-api/repository";
import { toQueryString } from "@/lib/url";
import { readRouteParam, type RouteParamSource } from "./route-params";

export type CompoundSampleQuery = Record<string, string | string[] | undefined>;

type FoundLookup = { status: "unique" } | { status: "ambiguous" };

interface CompoundSampleLoadOptions<TFound extends FoundLookup> {
  source: RouteParamSource;
  isSampleId: (sampleId: string) => boolean;
  lookup: (
    sampleId: string,
    discriminator?: string,
  ) => Promise<TFound | { status: "not-found" }>;
}

/**
 * A compound-sample page's record, or, when the data service is down, the
 * condensed reason (`recordUnavailableMessage`) for the page to render inside
 * its shell.
 */
export type CompoundSampleLoad<TFound extends FoundLookup> =
  | { sampleId: string; result: TFound }
  | { sampleId: string; unavailable: string };

/**
 * Resolve a compound-sample route's record from its raw `params.sampleId`.
 *
 * `source` says which entry point read `params.sampleId`, because Next
 * delivers the two different encodings of it — see `readRouteParam` in
 * `./route-params.ts` for the mechanism and the Next-internals citation. The
 * returned `sampleId` is the real identifier; use it for titles, canonical
 * hrefs and child props, never the raw param.
 */
export async function loadCompoundSamplePage<TFound extends FoundLookup>(
  rawSampleId: string,
  discriminator: string | undefined,
  options: CompoundSampleLoadOptions<TFound>,
): Promise<{ sampleId: string; result: TFound }> {
  const sampleId = readRouteParam(rawSampleId, options.source);
  if (!options.isSampleId(sampleId)) notFound();

  try {
    const result = await options.lookup(sampleId, discriminator);
    if (result.status === "not-found") notFound();
    return { sampleId, result };
  } catch (error) {
    if (error instanceof DataApiError && error.status === 404) notFound();
    throw error;
  }
}

/**
 * `loadCompoundSamplePage` for a page that renders an outage instead of
 * throwing it: production replaces a thrown server error's message with a
 * digest, so the boundary could only say that something failed. A 404 or a
 * missing record is still `notFound()`, and any error that is not an outage
 * (`recordUnavailableMessage` returns null) is still thrown.
 */
export async function loadCompoundSampleState<TFound extends FoundLookup>(
  rawSampleId: string,
  discriminator: string | undefined,
  options: CompoundSampleLoadOptions<TFound>,
): Promise<CompoundSampleLoad<TFound>> {
  const sampleId = readRouteParam(rawSampleId, options.source);
  if (!options.isSampleId(sampleId)) notFound();

  let result: TFound | { status: "not-found" };
  try {
    result = await options.lookup(sampleId, discriminator);
  } catch (error) {
    if (error instanceof DataApiError && error.status === 404) notFound();
    const unavailable = recordUnavailableMessage(error);
    if (unavailable === null) throw error;
    // Rendered, not thrown, so Next does not log it; once per request.
    if (options.source === "page") {
      console.error(`${sampleId}: sample lookup failed`, error);
    }
    return { sampleId, unavailable };
  }
  if (result.status === "not-found") notFound();
  return { sampleId, result };
}

export function scalarQueryParam(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function canonicalizeCompoundSampleUrl(
  sampleId: string,
  query: CompoundSampleQuery,
  options: {
    discriminatorParam: string;
    href: (sampleId: string) => string;
  },
): void {
  const discriminatorValue = query[options.discriminatorParam];
  const requestedTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (
    requestedTab === undefined &&
    !Array.isArray(discriminatorValue) &&
    discriminatorValue !== ""
  ) {
    return;
  }

  const next = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (
      name === "tab" ||
      name === options.discriminatorParam ||
      value === undefined
    ) {
      continue;
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      next.append(name, item);
    }
  }
  const discriminator = scalarQueryParam(discriminatorValue);
  if (discriminator) next.set(options.discriminatorParam, discriminator);
  redirect(
    `${options.href(sampleId)}${next.size ? `?${toQueryString(next)}` : ""}`,
  );
}
