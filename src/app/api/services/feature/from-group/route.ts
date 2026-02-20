import { NextRequest, NextResponse } from "next/server";
import { getBvbrcAuthToken } from "@/lib/auth";
import { getRequiredEnv } from "@/lib/env";


export async function POST(request: NextRequest) {
  try {
    const token = await getBvbrcAuthToken();

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const featureGroupPath: string = body?.feature_group_path;

    if (!featureGroupPath || typeof featureGroupPath !== "string" || featureGroupPath.trim() === "") {
      return NextResponse.json({ results: [] });
    }

    // URL encode the feature group path for the FeatureGroup() function
    // The path needs to be encoded but FeatureGroup() itself should not be encoded
    const encodedPath = encodeURIComponent(featureGroupPath.trim());
    
    // Build the query: ?in(feature_id,FeatureGroup(ENCODED_PATH))&limit(1000,0)
    // Select fields that are useful for display: feature_id, patric_id, annotation
    const queryString = `?in(feature_id,FeatureGroup(${encodedPath}))&limit(1000,0)`;
    const url = `${getRequiredEnv("BVBRC_WEBSITE_API_URL")}/genome_feature/${queryString}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: token,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Feature group lookup error:", response.status, errorText);
      return NextResponse.json(
        {
          error: `BV-BRC feature lookup failed: ${response.status} ${response.statusText}`,
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    const results = Array.isArray(data) ? data : data?.items || [];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Feature group lookup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
