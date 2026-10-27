import type { Metadata } from "next";
import { RecordUnavailable } from "@/components/errors/record-unavailable";
import { isSerologySampleId } from "@/lib/serology-view";
import { getSerology } from "@/lib/serology-view/server";
import {
  canonicalizeCompoundSampleUrl,
  type CompoundSampleQuery,
  loadCompoundSampleState,
  scalarQueryParam,
} from "@/lib/views/compound-sample-page";
import { serologyHref } from "@/lib/views/hrefs";
import { SerologyAmbiguity } from "./serology-ambiguity";
import { SerologyMember } from "./serology-member";

interface SerologyPageProps {
  params: Promise<{ sampleId: string }>;
  searchParams: Promise<CompoundSampleQuery>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SerologyPageProps): Promise<Metadata> {
  const [{ sampleId }, query] = await Promise.all([params, searchParams]);
  const loaded = await loadCompoundSampleState(
    sampleId,
    scalarQueryParam(query.test_type),
    { source: "metadata", isSampleId: isSerologySampleId, lookup: getSerology },
  );
  if ("unavailable" in loaded) {
    return { title: `${loaded.sampleId} | Serology` };
  }
  const { sampleId: decodedSampleId, result } = loaded;
  return {
    title: `${decodedSampleId} | Serology`,
    description:
      result.status === "ambiguous"
        ? `Select a test record for serology sample ${decodedSampleId}.`
        : `Serology sample ${result.record.sample_identifier}`,
  };
}

export default async function SerologyPage({
  params,
  searchParams,
}: SerologyPageProps) {
  const [{ sampleId }, query] = await Promise.all([params, searchParams]);
  const testType = scalarQueryParam(query.test_type);
  const loaded = await loadCompoundSampleState(
    sampleId,
    testType,
    { source: "page", isSampleId: isSerologySampleId, lookup: getSerology },
  );
  if ("unavailable" in loaded) {
    // An outage is rendered, not thrown: production would redact its message.
    return (
      <RecordUnavailable
        viewLabel="Serology View"
        recordLabel="Serology record"
        recordId={loaded.sampleId}
        message={loaded.unavailable}
        collectionHref="/serology"
        collectionLabel="Serology records"
      />
    );
  }
  const { sampleId: decodedSampleId, result } = loaded;
  canonicalizeCompoundSampleUrl(decodedSampleId, query, {
    discriminatorParam: "test_type",
    href: serologyHref,
  });

  if (result.status === "ambiguous") {
    return (
      <SerologyAmbiguity
        sampleId={decodedSampleId}
        testTypes={result.testTypes}
      />
    );
  }
  return <SerologyMember serology={result.record} />;
}
