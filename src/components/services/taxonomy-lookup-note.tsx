"use client";

import {
  describeTaxonomyLookupFailure,
  useTaxonomyLookupFailure,
} from "@/lib/forms/taxonomy-lookup";

/**
 * "Could not verify taxonomy ID N: <reason>" under a form's taxonomy fields,
 * after a rerun's taxon name lookup failed (`applyTaxonomyIdWithLookup`).
 * The restored ID and name stay, so the form is still submittable; the note
 * goes once the form holds another taxonomy ID.
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
