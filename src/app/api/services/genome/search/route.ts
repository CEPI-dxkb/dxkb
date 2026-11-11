import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import {
  fetchUpstream,
  upstreamServices,
  upstreamTimeoutMs,
} from "@/lib/api/upstream-failure";
import { getRequiredEnv } from "@/lib/env";

// The genome_name wildcard runs against a form with spaces and punctuation
// removed (as BV-BRC's GenomeNameSelector does), so a query keeping them finds nothing.
function sanitizeQuery(input: string): string {
  return input.replace(/[^a-zA-Z0-9.]/g, "");
}

export const GET = withAuth(async (request: NextRequest, { token }) => {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") || "";
  const limitParam = Number.parseInt(searchParams.get("limit") || "25", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 50)
    : 25;

  const trimmedQuery = rawQuery.trim();
  let queryString: string;

  if (!trimmedQuery) {
    queryString = `?or(eq(public,true),eq(public,false))&in(superkingdom,(Eukaryota,Bacteria,Viruses))&select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom)&limit(${String(limit)})`;
  } else {
    const sanitized = sanitizeQuery(trimmedQuery);

    if (!sanitized) {
      return NextResponse.json({ results: [] });
    }

    const wildcard = `*${sanitized}*`;
    queryString = `?or(eq(genome_name,${wildcard}),eq(genome_id,${wildcard}))&or(eq(public,true),eq(public,false))&in(superkingdom,(Eukaryota,Bacteria,Viruses))&select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom)&limit(${String(limit)})`;
  }

  const url = `${getRequiredEnv("NEXT_PUBLIC_DATA_API")}/genome/${queryString}`;

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
    console.error("Genome search error:", response.status, errorText);
    return NextResponse.json(
      {
        error: `BV-BRC genome search failed: ${String(response.status)} ${response.statusText}`,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as unknown[] | { items?: unknown[] };
  const results = Array.isArray(data) ? data : data.items ?? [];

  return NextResponse.json({ results });
});

