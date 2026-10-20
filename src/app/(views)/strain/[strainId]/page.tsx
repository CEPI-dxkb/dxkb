import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { recordUnavailableMessage } from "@/components/errors/record-load-failure";
import { RecordUnavailable } from "@/components/errors/record-unavailable";
import { DataApiError } from "@/lib/data-api/repository";
import { isStrainId } from "@/lib/strain-view";
import { getStrain } from "@/lib/strain-view/server";
import {
  readRouteParam,
  type RouteParamSource,
} from "@/lib/views/route-params";
import { StrainMember } from "./strain-member";

interface StrainPageProps {
  params: Promise<{ strainId: string }>;
}

async function loadStrain(rawStrainId: string, source: RouteParamSource) {
  // The two entry points receive this segment in different encodings, so
  // each declares which it is. See `readRouteParam`.
  const strainId = readRouteParam(rawStrainId, source);
  if (!isStrainId(strainId)) notFound();
  let strain: Awaited<ReturnType<typeof getStrain>>;
  try {
    strain = await getStrain(strainId);
  } catch (error) {
    if (error instanceof DataApiError && [401, 403, 404].includes(error.status))
      notFound();
    // An outage is rendered, not thrown: production would redact its message.
    const unavailable = recordUnavailableMessage(error);
    if (unavailable === null) throw error;
    if (source === "page") console.error(`strain/${strainId}:`, error);
    return { strainId, unavailable } as const;
  }
  if (!strain) notFound();
  return { strainId, strain } as const;
}

export async function generateMetadata({
  params,
}: StrainPageProps): Promise<Metadata> {
  const { strainId } = await params;
  const loaded = await loadStrain(strainId, "metadata");
  if (loaded.unavailable !== undefined) return { title: `${loaded.strainId} | Strain` };
  const { strain } = loaded;
  return {
    title: `${strain.strain ?? strain.id} | Strain`,
    description: strain.species ?? `Strain record ${strain.id}`,
  };
}

export default async function StrainPage({ params }: StrainPageProps) {
  const { strainId } = await params;
  const loaded = await loadStrain(strainId, "page");
  if (loaded.unavailable !== undefined) {
    return (
      <RecordUnavailable
        viewLabel="Strain View"
        recordLabel="Strain"
        recordId={loaded.strainId}
        message={loaded.unavailable}
        collectionHref="/strain"
        collectionLabel="Strains"
      />
    );
  }
  return <StrainMember strain={loaded.strain} />;
}
