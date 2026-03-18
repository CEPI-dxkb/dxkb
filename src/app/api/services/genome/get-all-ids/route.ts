import { NextResponse } from "next/server";
import { protectedRoute } from "@/lib/api/protected-route";
import { getRequiredEnv } from "@/lib/env";

export const POST = protectedRoute(async ({ token, request }) => {
  const body = await request.json().catch(() => ({}));
  const requestedLimit = Number.parseInt(
    body?.limit?.toString() || "10000",
    10,
  );
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 10000)
    : 10000;

  const queryParts = [
    `or(eq(genome_name,**),eq(genome_id,**))`,
    `or(eq(public,true),eq(public,false))`,
    `in(superkingdom,(Eukaryota,Bacteria,Viruses))`,
    `select(genome_id,genome_name,strain,public,owner,reference_genome,taxon_id)`,
    `limit(${limit})`,
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
      { error: `BV-BRC genome lookup failed: ${response.status} ${response.statusText}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  const results = Array.isArray(data) ? data : data?.items || [];

  return NextResponse.json({ results });
});
