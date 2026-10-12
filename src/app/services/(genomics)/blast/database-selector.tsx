"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { TaxIDSelector } from "@/components/taxonomy/tax-id-selector";
import { GenomeNameSelector } from "@/components/services/genome-name-selector";
import { SelectedGenomesTable } from "@/components/services/selected-genomes-table";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import type { BlastFormData } from "@/lib/forms/(genomics)/blast/blast-form-schema";
import { blastMaxGenomes } from "@/lib/forms/(genomics)/blast/blast-form-utils";
import type { WorkspaceSelectorPreset } from "@/components/workspace/workspace-selector-presets";
import { ServiceRequiredLabel } from "@/components/services/form-ui/service-required-label";
import { fetchGenomesByIds } from "@/lib/services/genome";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { TaxonomyItem } from "@/types";
import type { BlastForm } from "./page";

/**
 * `db_genome_list` holds genome IDs. As in BV-BRC's Homology app, a genome
 * name search adds genomes one at a time to a table the user can prune.
 * Names picked here are kept locally; IDs that arrive without one (a rerun)
 * are looked up, and shown as the bare ID if the lookup fails.
 */
function GenomeListField({ form }: { form: BlastForm }) {
  const [knownNames, setKnownNames] = useState<Partial<Record<string, string>>>({});
  const genomeIds = useSelector(
    form.store,
    (state) => state.values.db_genome_list ?? [],
  );

  const unnamedIds = genomeIds.filter((id) => !(id in knownNames));
  const { data: lookedUp } = useQuery({
    queryKey: ["blast-genome-names", unnamedIds],
    queryFn: ({ signal }) => fetchGenomesByIds(unnamedIds, { signal }),
    enabled: unnamedIds.length > 0,
    staleTime: Infinity,
  });
  // Keep each lookup's answer (an ID it did not find keeps its bare ID), so
  // removing a row, which changes unnamedIds and so the query key, does not
  // blank the names already resolved while a new lookup runs or after it fails.
  // It starts empty: a lookup already cached when the field mounts (a rerun
  // opened again) must still fill knownNames.
  const [keptLookup, setKeptLookup] = useState<typeof lookedUp>();
  if (lookedUp && lookedUp !== keptLookup) {
    setKeptLookup(lookedUp);
    const found = new Map(
      lookedUp.map((genome) => [genome.genome_id, genome.genome_name]),
    );
    setKnownNames((names) => ({
      ...names,
      ...Object.fromEntries(unnamedIds.map((id) => [id, found.get(id) ?? id])),
    }));
  }

  const rows = genomeIds.map((id) => ({ id, name: knownNames[id] ?? id }));

  return (
    <form.Field name="db_genome_list">
      {(field) => (
        <FieldItem>
          <GenomeNameSelector
            title=""
            placeholder="e.g. M. tuberculosis CDC1551"
            selectedGenomeIds={genomeIds}
            maxSelections={blastMaxGenomes}
            onSelect={(genome) => {
              setKnownNames((names) => ({
                ...names,
                [genome.genome_id]: genome.genome_name,
              }));
              field.handleChange([...genomeIds, genome.genome_id]);
            }}
          />
          <SelectedGenomesTable
            rows={rows}
            onRemove={(id) => {
              field.handleChange(genomeIds.filter((value) => value !== id));
            }}
          />
          <FieldErrors field={field} />
        </FieldItem>
      )}
    </form.Field>
  );
}

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
                    className="flex items-center gap-1 rounded-md border bg-background py-0.5 pr-0.5 pl-2 text-sm"
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
          <ServiceRequiredLabel>Select a taxon</ServiceRequiredLabel>
          <TaxonListField form={form} />
        </div>
      </div>
    );
  }
  if (database === "selGenome") {
    return (
      <div className="service-card-row">
        <div className="service-card-row-item">
          <ServiceRequiredLabel>Select a genome</ServiceRequiredLabel>
          <GenomeListField form={form} />
        </div>
      </div>
    );
  }
  type DatabaseObjectField =
    "db_genome_group" | "db_feature_group" | "db_fasta_file";
  const config: [
    name: DatabaseObjectField,
    label: string,
    objectPreset: WorkspaceSelectorPreset,
  ] | null =
    database === "selGroup"
      ? ["db_genome_group", "Select a genome group", "genomeGroup"]
      : database === "selFeatureGroup"
        ? ["db_feature_group", "Select a feature group", "featureGroup"]
        : database === "selFasta"
          ? ["db_fasta_file", "Select a FASTA file", preset]
          : null;
  if (!config) return null;
  const [name, label, objectPreset] = config;
  const placeholder = `${label}...`;
  return (
    <div className="service-card-row">
      <div className="service-card-row-item">
        <ServiceRequiredLabel>
          {label}
        </ServiceRequiredLabel>
        {/* Keyed so each picker source gets its own field and picker, not one
            live field that swaps `name` and carries the picker's state across.
            The "required" error on a return visit is kept away by
            changeDatabase's clears, which do not validate (see page.tsx). */}
        <form.Field key={name} name={name}>
          {(field) => (
            <FieldItem>
              <WorkspaceObjectSelector
                preset={objectPreset}
                placeholder={placeholder}
                value={field.state.value ?? ""}
                onObjectSelect={(object: WorkspaceObject) => {
                  field.handleChange(object.path);
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
