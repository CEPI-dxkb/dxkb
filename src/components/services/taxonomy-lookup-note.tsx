"use client";

import {
  describeTaxonomyLookupFailure,
  useTaxonomyLookupFailure,
} from "@/lib/forms/taxonomy-lookup";

/**
 * Shown after a rerun's taxon name lookup failed; the restored ID and name
 * stay, and it goes once the form holds another taxonomy ID.
 */
export function TaxonomyLookupNote({
  form,
  taxonomyId,
}: {
  form: object;
  taxonomyId: string | null | undefined;
}) {
  const failure = useTaxonomyLookupFailure(form);
  if (!failure || failure.taxonomyId !== taxonomyId) return null;
  return (
    <p role="alert" className="text-xs text-muted-foreground">
      {describeTaxonomyLookupFailure(failure)}
    </p>
  );
}
