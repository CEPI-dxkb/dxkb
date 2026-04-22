import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { auth } from "@/lib/auth/server/instance";

/**
 * Base URL for PATRIC/BV-BRC genome API (e.g. https://patricbrc.org/api or BV-BRC equivalent).
 * Genome endpoint: ${BVBRC_WEBSITE_API_URL}/genome/
 */
const genomeWebsiteApi = `${process.env.BVBRC_WEBSITE_API_URL}/genome/`;

const maxRows = 25_000;

function csvToJson(csvText: string): Record<string, string>[] {
  const trimmed = csvText.trim();
  if (trimmed.length === 0) return [];

  try {
    const records = parse(trimmed, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    return records.map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        out[k] = v ?? "";
      }
      return out;
    });
  } catch (err) {
    console.error("CSV parse error:", err);
    throw err;
  }
}

function escapeSolrTerm(value: string): string {
  return value.replace(/([+\-!(){}[\]^"~*?:\\/]|&&|\|\|)/g, "\\$1");
}

export const POST = auth.route(async (request: NextRequest, { token }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const genomeIds: string[] = Array.isArray(body?.genome_ids)
      ? (body.genome_ids as string[]).map((id: unknown) => String(id).trim())
      : [];

    if (genomeIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const escapedIds = genomeIds
      .filter((id) => id.length > 0)
      .map((id) => `"${escapeSolrTerm(id)}"`);
    const q = `genome_id:(${escapedIds.join(" OR ")})`;
    const rowsParam = String(Math.min(maxRows, genomeIds.length));

    const formBody = new URLSearchParams({ rows: rowsParam, q });

    const response = await fetch(genomeWebsiteApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/solrquery+x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: token,
      },
      body: formBody.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Genome website query error:", response.status, errorText);
      return NextResponse.json(
        {
          error: `BV-BRC genome query failed: ${response.status} ${response.statusText}`,
        },
        { status: response.status },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();

    if (contentType.includes("application/json")) {
      const data = JSON.parse(text);
      const results = Array.isArray(data) ? data : data?.items ?? data?.results ?? [];
      return NextResponse.json({ results });
    }

    const results = csvToJson(text);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Genome website query API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
});
