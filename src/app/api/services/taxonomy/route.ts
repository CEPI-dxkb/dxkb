import { NextRequest, NextResponse } from "next/server";
import { getRequiredEnv } from "@/lib/env";
import { withErrorHandling } from "@/lib/api/server";
import { statusToErrorCode } from "@/lib/api/types";

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const queryString = searchParams.toString();
  const baseUrl = getRequiredEnv("BVBRC_WEBSITE_API_URL");

  const response = await fetch(`${baseUrl}/taxonomy?${queryString}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/solrquery+x-www-form-urlencoded",
    },
  });

  if (!response.ok) {
    console.error("BV-BRC Taxonomy API error:", response.status, response.statusText);
    return NextResponse.json(
      {
        error: `BV-BRC Taxonomy API error: ${response.status} ${response.statusText}`,
        code: statusToErrorCode(response.status),
      },
      { status: response.status },
    );
  }

  const data = await response.json();
  return NextResponse.json(data);
});
