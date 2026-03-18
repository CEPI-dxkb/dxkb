import { NextResponse } from "next/server";
import { protectedRoute } from "@/lib/api/protected-route";
import { getRequiredEnv } from "@/lib/env";

function sanitizeQuery(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "");
}

export const GET = protectedRoute(async ({ token, searchParams }) => {
  const rawQuery = searchParams.get("q") || "";
  const limitParam = Number.parseInt(searchParams.get("limit") || "25", 10);
  const limit = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), 50)
    : 25;

  const trimmedQuery = rawQuery.trim();
  let queryString: string;

  if (!trimmedQuery) {
    queryString = `?or(eq(public,true),eq(public,false))&in(superkingdom,(Eukaryota,Bacteria,Viruses))&select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom)&limit(${limit})`;
  } else {
    const sanitized = sanitizeQuery(trimmedQuery);

    if (!sanitized) {
      return NextResponse.json({ results: [] });
    }

    const wildcard = `*${sanitized}*`;
    queryString = `?or(eq(genome_name,${wildcard}),eq(genome_id,${wildcard}))&or(eq(public,true),eq(public,false))&in(superkingdom,(Eukaryota,Bacteria,Viruses))&select(genome_id,genome_name,public,owner,reference_genome,strain,superkingdom)&limit(${limit})`;
  }

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
    console.error("Genome search error:", response.status, errorText);
    return NextResponse.json(
      { error: `BV-BRC genome search failed: ${response.status} ${response.statusText}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  const results = Array.isArray(data) ? data : data?.items || [];

  return NextResponse.json({ results });
});
