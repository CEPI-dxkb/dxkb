import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/server";
import { getRequiredEnv } from "@/lib/env";
import type { ViralGenomeValidationResult } from "@/lib/services/genome";
import { buildGenomeInClause } from "../utils";

export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = await request.json();
  const genomeIds: string[] = Array.isArray(body?.genome_ids)
    ? body.genome_ids
    : [];

  if (genomeIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const inClause = buildGenomeInClause(genomeIds);

  if (!inClause) {
    return NextResponse.json({ results: [] });
  }

  // Query with fields needed for viral genome validation
  const queryString = `?in(genome_id,(${inClause}))&select(genome_id,superkingdom,genome_length,contigs)&limit(${Math.min(genomeIds.length, 5000)})`;
  const url = `${getRequiredEnv("NEXT_PUBLIC_DATA_API")}/genome/${queryString}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: token,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Genome validation error:", response.status, errorText);
    return NextResponse.json(
      {
        error: `BV-BRC genome validation failed: ${response.status} ${response.statusText}`,
      },
      { status: response.status },
    );
  }

  const data = await response.json();
  const results: ViralGenomeValidationResult[] = Array.isArray(data) ? data : data?.items || [];

  return NextResponse.json({ results });
});

