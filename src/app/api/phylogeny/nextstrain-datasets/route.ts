import { type NextRequest, NextResponse } from "next/server";

import {
  availableDatasetIds,
  remoteDatasetExists,
} from "@/lib/phylogeny/dataset-store";
import { canonicalDatasetId } from "@/lib/phylogeny/nextstrain-dataset";

export const runtime = "nodejs";

// Each remote probe is a 30s outbound HEAD, so cap distinct ids and concurrency.
const maxProbedDatasetIds = 20;
const probeConcurrency = 5;

async function probeRemoteIds(
  candidateIds: string[],
  found: Set<string>,
): Promise<void> {
  const queue = [...candidateIds];

  async function worker(): Promise<void> {
    for (let id = queue.shift(); id; id = queue.shift()) {
      if (await remoteDatasetExists(id)) found.add(id);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(probeConcurrency, queue.length) }, worker),
  );
}

export async function GET(request: NextRequest) {
  try {
    const localIds = await availableDatasetIds();
    const requestedIds = request.nextUrl.searchParams.getAll("id");
    const ids = new Set(localIds);

    const candidateIds = new Set<string>();
    for (const value of requestedIds) {
      const id = canonicalDatasetId(value);
      if (id && !localIds.has(id)) candidateIds.add(id);
    }

    await probeRemoteIds([...candidateIds].slice(0, maxProbedDatasetIds), ids);

    return NextResponse.json({ ids: [...ids].sort() });
  } catch (error) {
    console.error("nextstrain inventory unavailable", error);
    return NextResponse.json(
      { error: "dataset store unavailable" },
      { status: 500 },
    );
  }
}
