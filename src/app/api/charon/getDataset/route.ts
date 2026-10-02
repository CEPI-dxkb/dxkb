import { type NextRequest, NextResponse } from "next/server";

import {
  fetchRemoteDataset,
  readDataset,
  sidecars,
  type Sidecar,
} from "@/lib/phylogeny/dataset-store";
import {
  canonicalDatasetId,
  stripViewerPrefix,
} from "@/lib/phylogeny/nextstrain-dataset";

export const runtime = "nodejs";

function isSidecar(value: string): value is Sidecar {
  return (sidecars as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get("prefix");
  if (!prefix) {
    return NextResponse.json({ error: "prefix is required" }, { status: 400 });
  }

  const type = request.nextUrl.searchParams.get("type");
  // The store uses an omitted sidecar for the main tree JSON.
  const sidecar = type === null || type === "tree" ? undefined : type;
  if (sidecar !== undefined && !isSidecar(sidecar)) {
    return NextResponse.json(
      { error: "unsupported dataset type" },
      { status: 400 },
    );
  }

  const datasetId = canonicalDatasetId(stripViewerPrefix(prefix));
  if (!datasetId) {
    return NextResponse.json(
      { error: "invalid dataset identifier" },
      { status: 400 },
    );
  }

  try {
    let body: string | null;
    let remoteError: Error | null = null;
    try {
      body = await fetchRemoteDataset(datasetId, sidecar);
    } catch (error) {
      body = null;
      remoteError =
        error instanceof Error ? error : new Error("remote dataset unavailable");
    }
    body ??= await readDataset(datasetId, sidecar);

    if (body === null) {
      if (remoteError !== null) throw remoteError;
      return NextResponse.json({ error: "dataset not found" }, { status: 404 });
    }

    return new NextResponse(body, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error(
      "charon/getDataset: dataset sources unavailable for '%s'",
      datasetId,
      error,
    );
    return NextResponse.json(
      { error: "dataset sources unavailable" },
      { status: 500 },
    );
  }
}
