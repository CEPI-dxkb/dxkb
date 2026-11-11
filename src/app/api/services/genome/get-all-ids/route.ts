import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import { getRequiredEnv } from "@/lib/env";

interface GetAllIdsBody {
  limit?: unknown;
}

export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = (await request.json().catch(() => ({}))) as GetAllIdsBody;
  const rawLimit = typeof body.limit === "string" || typeof body.limit === "number" ? body.limit : 10000;
  const requestedLimit = Number.parseInt(String(rawLimit), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 10000)
    : 10000;

  const queryParts = [
    `or(eq(genome_name,**),eq(genome_id,**))`,
    `or(eq(public,true),eq(public,false))`,
    `in(superkingdom,(Eukaryota,Bacteria,Viruses))`,
    `select(genome_id,genome_name,strain,public,owner,reference_genome,taxon_id)`,
    `limit(${String(limit)})`,
  ];
  const queryString = `?${queryParts.join("&")}`;
  const url = `${getRequiredEnv("BVBRC_WEBSITE_API_URL")}/genome/${queryString}`;

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
        error: `BV-BRC genome lookup failed: ${String(response.status)} ${response.statusText}`,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as unknown[] | { items?: unknown[] } | null;
  const results = Array.isArray(data) ? data : (data?.items ?? []);

  return NextResponse.json({ results });
});
