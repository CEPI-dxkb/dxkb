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

/** A failed lookup (service down) is not "no such taxon": callers keep what they have. */
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
  onResolved?: (taxonName: string) => void;
  onFailed?: (error: string) => void;
}

export interface TaxonomyLookupFailure {
  taxonomyId: string;
  error: string;
}

// Keyed by form object so a failure goes away with its form.
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

/** Show only while the form still holds `taxonomyId`. */
export function useTaxonomyLookupFailure(
  form: object,
): TaxonomyLookupFailure | null {
  return useSyncExternalStore(
    subscribeToLookupFailures,
    () => lookupFailures.get(form) ?? null,
    () => null,
  );
}

export function describeTaxonomyLookupFailure(
  failure: TaxonomyLookupFailure,
): string {
  return `Could not verify taxonomy ID ${failure.taxonomyId}: ${failure.error}`;
}

/** Sets `taxonomy_id`, then resolves `scientific_name`; a failed lookup is recorded for the form. */
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
