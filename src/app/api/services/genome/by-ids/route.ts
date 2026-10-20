import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  fetchUpstream,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { getRequiredEnv } from "@/lib/env";
import { buildGenomeInClause } from "../utils";

interface GenomeByIdsBody {
  genome_ids?: unknown;
  fields?: unknown;
}

const defaultFields = [
  "genome_id",
  "genome_name",
  "public",
  "owner",
  "reference_genome",
  "strain",
  "superkingdom",
];

/**
 * The select list: the default fields plus any extra ones the caller asks for
 * (Meta-CATS needs `genbank_accessions` and the metadata it groups by). Only
 * plain field identifiers pass, so a name cannot close `select(` and append
 * its own RQL.
 */
function selectFields(extra: unknown): string[] {
  const requested = Array.isArray(extra)
    ? extra.filter(
        (field): field is string =>
          typeof field === "string" && /^[a-z0-9_]+$/.test(field),
      )
    : [];
  return [...new Set([...defaultFields, ...requested])];
}

export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = (await request.json()) as GenomeByIdsBody;
  const genomeIds: string[] = Array.isArray(body.genome_ids)
    ? (body.genome_ids as string[])
    : [];

  if (genomeIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const inClause = buildGenomeInClause(genomeIds);

  if (!inClause) {
    return NextResponse.json({ results: [] });
  }

  const queryString = `?in(genome_id,(${inClause}))&select(${selectFields(body.fields).join(",")})&limit(${String(Math.min(genomeIds.length, 100))})`;
  const url = `${getRequiredEnv("NEXT_PUBLIC_DATA_API")}/genome/${queryString}`;

  // A network failure or spent budget throws an UpstreamError, which
  // withAuth's errorResponse answers with its 502/503/504.
  const response = await fetchUpstream(
    url,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: token,
      },
    },
    { service: upstreamServices.dataApi, timeoutMs: upstreamTimeoutMs.dataApi },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Genome lookup error:", response.status, errorText);
    return NextResponse.json(
      {
        error: `BV-BRC genome lookup failed: ${String(response.status)} ${response.statusText}`,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as unknown[] | { items?: unknown[] };
  const results = Array.isArray(data) ? data : data.items ?? [];

  return NextResponse.json({ results });
});

