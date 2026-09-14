"use client";

import { useState } from "react";
import { useSelector } from "@tanstack/react-store";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { RequiredFormLabel } from "@/components/forms/required-form-components";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import type { BlastFormData } from "@/lib/forms/(genomics)/blast/blast-form-schema";
import type { WorkspaceSelectorPreset } from "@/components/workspace/workspace-selector-presets";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { TaxonomyItem } from "@/types";
import type { BlastForm } from "./page";

/**
 * `db_taxon_list` holds Taxon IDs, not a workspace path, so it uses the taxon
 * autocomplete (as Genome Annotation and SARS-CoV-2 Genome Analysis do) bound to the
 * field's current value. A `WorkspaceObjectSelector` here left prefilled Taxon IDs
 * invisible and replaced them with a workspace path as soon as it was touched.
 */
function TaxonListField({ form }: { form: BlastForm }) {
  const [pendingTaxon, setPendingTaxon] = useState<TaxonomyItem | null>(null);
  const taxonIds = useSelector(
    form.store,
    (state) => state.values.db_taxon_list ?? [],
  );

  const selectedTaxon =
    pendingTaxon && taxonIds.includes(String(pendingTaxon.taxon_id))
      ? pendingTaxon
      : null;
  if (pendingTaxon && !selectedTaxon) {
    setPendingTaxon(null);
  }

  return (
    <form.Field name="db_taxon_list">
      {(field) => {
        return (
          <FieldItem>
            <TaxIDSelector
              value={selectedTaxon}
              onChange={(item) => {
                setPendingTaxon(item);
                if (!item) return;
                const taxonId = String(item.taxon_id);
                if (taxonIds.includes(taxonId)) return;
                field.handleChange([...taxonIds, taxonId]);
              }}
              placeholder="NCBI Taxonomy ID..."
              required={taxonIds.length === 0}
            />
            {taxonIds.length > 0 && (
              <ul aria-label="Selected taxa" className="flex flex-wrap gap-1.5">
                {taxonIds.map((taxonId) => (
                  <li
                    key={taxonId}
                    className="flex items-center gap-1 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-sm"
                  >
                    {taxonId}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5"
                      aria-label={`Remove taxon ${taxonId}`}
                      onClick={() => {
                        field.handleChange(
                          taxonIds.filter((value) => value !== taxonId),
                        );
                        if (pendingTaxon?.taxon_id === Number(taxonId)) {
                          setPendingTaxon(null);
                        }
                      }}
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <FieldErrors field={field} />
          </FieldItem>
        );
      }}
    </form.Field>
  );
}

export function DatabaseSelector({
  form,
  database,
  preset,
}: {
  form: BlastForm;
  database: BlastFormData["db_precomputed_database"];
  preset: WorkspaceSelectorPreset;
}) {
  if (database === "selTaxon") {
    return (
      <div className="service-card-row">
        <div className="service-card-row-item">
          <RequiredFormLabel className="service-card-label">
            Select a taxon
          </RequiredFormLabel>
          <TaxonListField form={form} />
        </div>
      </div>
    );
  }
  const config =
    database === "selGenome"
      ? ["db_genome_list", "Select a genome", "unspecified", true]
      : database === "selGroup"
        ? ["db_genome_group", "Select a genome group", "genomeGroup", false]
        : database === "selFeatureGroup"
          ? [
              "db_feature_group",
              "Select a feature group",
              "featureGroup",
              false,
            ]
          : database === "selFasta"
            ? ["db_fasta_file", "Select a FASTA file", preset, false]
            : null;
  if (!config) return null;
  const [name, label, objectPreset, array] = config;
  const placeholder = typeof label === "string" ? `${label}...` : "Select...";
  return (
    <div className="service-card-row">
      <div className="service-card-row-item">
        <RequiredFormLabel className="service-card-label">
          {label}
        </RequiredFormLabel>
        <form.Field name={name as keyof BlastFormData}>
          {(field) => (
            <FieldItem>
              <WorkspaceObjectSelector
                preset={objectPreset as WorkspaceSelectorPreset}
                placeholder={placeholder}
                onObjectSelect={(object: WorkspaceObject) => {
                  field.handleChange(array ? [object.path] : object.path);
                }}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
      </div>
    </div>
  );
}
