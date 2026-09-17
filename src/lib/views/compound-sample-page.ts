import { notFound, redirect } from "next/navigation";
import { DataApiError } from "@/lib/data-api/repository";
import { readRouteParam, type RouteParamSource } from "./route-params";

export type CompoundSampleQuery = Record<string, string | string[] | undefined>;

type FoundLookup = { status: "unique" } | { status: "ambiguous" };

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
  options: {
    source: RouteParamSource;
    isSampleId: (sampleId: string) => boolean;
    lookup: (
      sampleId: string,
      discriminator?: string,
    ) => Promise<TFound | { status: "not-found" }>;
  },
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
  redirect(`${options.href(sampleId)}${next.size ? `?${next}` : ""}`);
}
