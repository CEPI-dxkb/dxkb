import { NextResponse } from "next/server";
import { protectedRoute } from "@/lib/api/protected-route";
import { getRequiredEnv } from "@/lib/env";

export const POST = protectedRoute(async ({ token, request }) => {
  const body = await request.json();
  const featureGroupPath: string = body?.feature_group_path;

  if (!featureGroupPath || typeof featureGroupPath !== "string" || featureGroupPath.trim() === "") {
    return NextResponse.json({ results: [] });
  }

  const encodedPath = encodeURIComponent(featureGroupPath.trim());
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
      { error: `BV-BRC feature lookup failed: ${response.status} ${response.statusText}` },
      { status: response.status },
    );
  }

  const data = await response.json();
  const results = Array.isArray(data) ? data : data?.items || [];

  return NextResponse.json({ results });
});
