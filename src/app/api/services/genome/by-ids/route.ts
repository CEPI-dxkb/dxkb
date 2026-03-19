import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth/session";
import { getRequiredEnv } from "@/lib/env";


function buildInClause(ids: string[]): string {
  const sanitizedIds = ids
    .map((id) => id.trim())
    .filter((id) => /^[0-9.]+$/.test(id));

  return sanitizedIds.join(",");
}

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const genomeIds: string[] = Array.isArray(body?.genome_ids)
      ? body.genome_ids
      : [];

    if (genomeIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const inClause = buildInClause(genomeIds);

    if (!inClause) {
      return NextResponse.json({ results: [] });
    }

    const queryString = `?in(genome_id,(${inClause}))&select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom)&limit(${Math.min(genomeIds.length, 100)})`;
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
      console.error("Genome lookup error:", response.status, errorText);
      return NextResponse.json(
        {
          error: `BV-BRC genome lookup failed: ${response.status} ${response.statusText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const results = Array.isArray(data) ? data : data?.items || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Genome lookup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

