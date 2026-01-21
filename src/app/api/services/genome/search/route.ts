import { NextRequest, NextResponse } from "next/server";
import { getServerAuthToken } from "@/lib/auth";

const DATA_API_BASE = "https://p3.theseed.org/services/data_api/genome/";

function sanitizeQuery(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q") || "";
    const limitParam = Number.parseInt(searchParams.get("limit") || "25", 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 50)
      : 25;

    const token = await getServerAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const trimmedQuery = rawQuery.trim();
    let queryString: string;

    if (!trimmedQuery) {
      // Blank query - return all genomes with filters (no search filter)
      queryString = `?or(eq(public,true),eq(public,false))&in(superkingdom,(Eukaryota,Bacteria,Viruses))&select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom)&limit(${limit})`;
    } else {
      // Has query - apply search filter
      const sanitized = sanitizeQuery(trimmedQuery);

      if (!sanitized) {
        return NextResponse.json({ results: [] });
      }

      const wildcard = `*${sanitized}*`;
      queryString = `?or(eq(genome_name,${wildcard}),eq(genome_id,${wildcard}))&or(eq(public,true),eq(public,false))&in(superkingdom,(Eukaryota,Bacteria,Viruses))&select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom)&limit(${limit})`;
    }

    const url = `${DATA_API_BASE}${queryString}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Genome search error:", response.status, errorText);
      return NextResponse.json(
        {
          error: `BV-BRC genome search failed: ${response.status} ${response.statusText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const results = Array.isArray(data) ? data : data?.items || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Genome search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

