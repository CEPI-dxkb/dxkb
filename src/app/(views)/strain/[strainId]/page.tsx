import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  try {
    const strain = await getStrain(strainId);
    if (!strain) notFound();
    return strain;
  } catch (error) {
    if (error instanceof DataApiError && [401, 403, 404].includes(error.status))
      notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: StrainPageProps): Promise<Metadata> {
  const { strainId } = await params;
  const strain = await loadStrain(strainId, "metadata");
  return {
    title: `${strain.strain ?? strain.id} | Strain`,
    description: strain.species ?? `Strain record ${strain.id}`,
  };
}

export default async function StrainPage({ params }: StrainPageProps) {
  const { strainId } = await params;
  const strain = await loadStrain(strainId, "page");
  return <StrainMember strain={strain} />;
}
