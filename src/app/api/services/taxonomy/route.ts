import { NextRequest, NextResponse } from "next/server";

/**
 * Taxonomy API proxy route
 * Forwards requests to https://www.bv-brc.org/api-for-website/taxonomy
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters from the request
    const { searchParams } = new URL(request.url);

    // Forward all query parameters to the BV-BRC taxonomy API
    const queryString = searchParams.toString();

    // Make the request to BV-BRC Taxonomy API
    const response = await fetch(
      `https://www.bv-brc.org/api-for-website/taxonomy?${queryString}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/solrquery+x-www-form-urlencoded",
        },
      },
    );

    if (!response.ok) {
      console.error(
        "BV-BRC Taxonomy API error:",
        response.status,
        response.statusText,
      );
      return NextResponse.json(
        {
          error: `BV-BRC Taxonomy API error: ${response.status} ${response.statusText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Taxonomy API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
