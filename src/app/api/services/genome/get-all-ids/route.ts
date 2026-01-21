import { NextRequest, NextResponse } from "next/server";
import { getServerAuthToken } from "@/lib/auth";

const GENOME_API_BASE = "https://www.bv-brc.org/api-for-website/genome/";

export async function POST(request: NextRequest) {
  try {
    const token = await getServerAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const queryParts = [
      `or(eq(genome_name,**),eq(genome_id,**))`,
      `or(eq(public,true),eq(public,false))`,
      `in(superkingdom,(Eukaryota,Bacteria,Viruses))`,
      `select(genome_id,genome_name,strain,public,owner,reference_genome,taxon_id)`,
    ];
    const queryString = `?${queryParts.join("&")}`;
    const url = `${GENOME_API_BASE}${queryString}`;

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
