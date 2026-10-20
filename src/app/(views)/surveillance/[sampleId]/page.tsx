import type { Metadata } from "next";
import { RecordUnavailable } from "@/components/errors/record-unavailable";
import { isSurveillanceSampleId } from "@/lib/surveillance-view";
import { getSurveillance } from "@/lib/surveillance-view/server";
import {
  canonicalizeCompoundSampleUrl,
  type CompoundSampleQuery,
  loadCompoundSampleState,
  scalarQueryParam,
} from "@/lib/views/compound-sample-page";
import { surveillanceHref } from "@/lib/views/hrefs";
import { SurveillanceAmbiguity } from "./surveillance-ambiguity";
import { SurveillanceMember } from "./surveillance-member";

interface SurveillancePageProps {
  params: Promise<{ sampleId: string }>;
  searchParams: Promise<CompoundSampleQuery>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SurveillancePageProps): Promise<Metadata> {
  const [{ sampleId }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadCompoundSampleState(
    sampleId,
    scalarQueryParam(query.pathogen_test_type),
    {
      source: "metadata",
      isSampleId: isSurveillanceSampleId,
      lookup: getSurveillance,
    },
  );
  if ("unavailable" in loaded) {
    return { title: `${loaded.sampleId} | Surveillance` };
  }
  const { sampleId: decodedSampleId, result } = loaded;
  return {
    title: `${decodedSampleId} | Surveillance`,
    description:
      result.status === "ambiguous"
        ? `Select a pathogen test record for surveillance sample ${decodedSampleId}.`
        : `Surveillance sample ${result.record.sample_identifier}`,
  };
}

export default async function SurveillancePage({
  params,
  searchParams,
}: SurveillancePageProps) {
  const [{ sampleId }, query] = await Promise.all([params, searchParams]);
  const pathogenTestType = scalarQueryParam(query.pathogen_test_type);
  const loaded = await loadCompoundSampleState(
    sampleId,
    pathogenTestType,
    {
      source: "page",
      isSampleId: isSurveillanceSampleId,
      lookup: getSurveillance,
    },
  );
  if ("unavailable" in loaded) {
    // An outage is rendered, not thrown: production would redact its message.
    return (
      <RecordUnavailable
        viewLabel="Surveillance View"
        recordLabel="Surveillance record"
        recordId={loaded.sampleId}
        message={loaded.unavailable}
        collectionHref="/surveillance"
        collectionLabel="Surveillance records"
      />
    );
  }
  const { sampleId: decodedSampleId, result } = loaded;
  canonicalizeCompoundSampleUrl(decodedSampleId, query, {
    discriminatorParam: "pathogen_test_type",
    href: surveillanceHref,
  });

  if (result.status === "ambiguous") {
    return (
      <SurveillanceAmbiguity
        sampleId={decodedSampleId}
        testTypes={result.testTypes}
      />
    );
  }
  return <SurveillanceMember surveillance={result.record} />;
}
