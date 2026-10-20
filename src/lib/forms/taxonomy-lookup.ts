import { useSyncExternalStore } from "react";

import { apiGet } from "@/lib/api/client";
import { formatUserFacingErrorMessage } from "@/lib/utils";

interface TaxonomyDoc {
  taxon_name?: unknown;
}

function extractTaxonomyDocs(data: unknown): TaxonomyDoc[] {
  if (Array.isArray(data)) return data as TaxonomyDoc[];
  if (!data || typeof data !== "object" || !("response" in data)) return [];
  const response = (data as { response?: { docs?: unknown } }).response;
  return Array.isArray(response?.docs) ? (response.docs as TaxonomyDoc[]) : [];
}

/**
 * The outcome of looking a taxon name up by ID. A failed lookup (the
 * taxonomy service is down) is not "no such taxon": callers keep what they
 * already have and say the ID could not be verified.
 */
export type TaxonNameLookup =
  | { status: "found"; name: string }
  | { status: "notFound" }
  | { status: "failed"; error: string };

export async function fetchTaxonNameById(
  taxonId: string,
): Promise<TaxonNameLookup> {
  try {
    const data = await apiGet<unknown>("/api/services/taxonomy", {
      q: `taxon_id:${taxonId}`,
      fl: "taxon_id,taxon_name",
    });
    const name = extractTaxonomyDocs(data)[0]?.taxon_name;
    return typeof name === "string" && name.length > 0
      ? { status: "found", name }
      : { status: "notFound" };
  } catch (error) {
    return {
      status: "failed",
      error: formatUserFacingErrorMessage(error, "Taxonomy lookup failed"),
    };
  }
}

interface TaxonomyForm {
  setFieldValue: (
    field: "taxonomy_id" | "scientific_name",
    value: string,
  ) => void;
}

export interface TaxonomyLookupCallbacks {
  /** The lookup found the taxon's name (already set as `scientific_name`). */
  onResolved?: (taxonName: string) => void;
  /** The lookup could not run; `error` is its condensed reason. */
  onFailed?: (error: string) => void;
}

/** A rerun's taxonomy ID whose name lookup failed, and why. */
export interface TaxonomyLookupFailure {
  taxonomyId: string;
  error: string;
}

// Keyed by the form object, so a failure belongs to one form on one visit
// and is gone with it; a new visit has a new form.
const lookupFailures = new WeakMap<object, TaxonomyLookupFailure>();
const lookupFailureListeners = new Set<() => void>();

function recordLookupFailure(
  form: object,
  failure: TaxonomyLookupFailure | null,
): void {
  if (failure) lookupFailures.set(form, failure);
  else lookupFailures.delete(form);
  for (const listener of lookupFailureListeners) listener();
}

function subscribeToLookupFailures(listener: () => void): () => void {
  lookupFailureListeners.add(listener);
  return () => {
    lookupFailureListeners.delete(listener);
  };
}

/**
 * The failed lookup `applyTaxonomyIdWithLookup` last recorded for `form`, if
 * any. Show it only while the form still holds `taxonomyId`: once the user
 * picks another taxon, it no longer applies.
 */
export function useTaxonomyLookupFailure(
  form: object,
): TaxonomyLookupFailure | null {
  return useSyncExternalStore(
    subscribeToLookupFailures,
    () => lookupFailures.get(form) ?? null,
    () => null,
  );
}

/** "Could not verify taxonomy ID 83332: <reason>", for the field's note. */
export function describeTaxonomyLookupFailure(
  failure: TaxonomyLookupFailure,
): string {
  return `Could not verify taxonomy ID ${failure.taxonomyId}: ${failure.error}`;
}

/**
 * Sets `taxonomy_id` immediately, then looks up the taxon name and sets
 * `scientific_name` when resolved. Callers restore whatever name the job
 * already carries before calling this, so a failed lookup leaves it in place
 * and is recorded for the form (`useTaxonomyLookupFailure`), so the field can
 * say the ID could not be verified. Services with extra post-resolution work
 * (e.g. deriving my_label from a prior output_file) pass `onResolved`.
 *
 * `form` is typed loose to accept any TanStack form whose value type includes
 * the `taxonomy_id` / `scientific_name` string fields.
 */
export function applyTaxonomyIdWithLookup(
  taxonomyId: string,
  form: TaxonomyForm,
  callbacks: TaxonomyLookupCallbacks = {},
): void {
  form.setFieldValue("taxonomy_id", taxonomyId);
  recordLookupFailure(form, null);
  void fetchTaxonNameById(taxonomyId).then((lookup) => {
    if (lookup.status === "failed") {
      recordLookupFailure(form, { taxonomyId, error: lookup.error });
      callbacks.onFailed?.(lookup.error);
      return;
    }
    if (lookup.status !== "found") return;
    form.setFieldValue("scientific_name", lookup.name);
    callbacks.onResolved?.(lookup.name);
  });
}
