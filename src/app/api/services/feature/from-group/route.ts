import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/server/route";
import { getRequiredEnv } from "@/lib/env";

interface FeatureGroupBody {
  feature_group_path?: unknown;
}

export const POST = withAuth(async (request: NextRequest, { token }) => {
  const body = (await request.json()) as FeatureGroupBody;
  const featureGroupPath: string =
    typeof body.feature_group_path === "string" ? body.feature_group_path : "";

  if (!featureGroupPath || typeof featureGroupPath !== "string" || featureGroupPath.trim() === "") {
    return NextResponse.json({ results: [] });
  }

  // The path is encoded but FeatureGroup() itself must not be.
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
      {
        error: `BV-BRC feature lookup failed: ${String(response.status)} ${response.statusText}`,
      },
      { status: response.status },
    );
  }

  const data = (await response.json()) as unknown[] | { items?: unknown[] };
  const results = Array.isArray(data) ? data : data.items ?? [];

  return NextResponse.json({ results });
});
