import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormLabelInfo } from "@/components/forms/required-form-components";
import {
  blastServiceDatabaseSource,
  blastServiceDatabaseType,
} from "@/lib/services/info/blast";
import { blastPrecomputedDatabases } from "@/types/services";
import {
  evalueOptionsBlast,
  maxHitsOptionsBlast,
} from "@/lib/forms/(genomics)/blast/blast-form-utils";
import type { BlastFormData } from "@/lib/forms/(genomics)/blast/blast-form-schema";
import type { WorkspaceSelectorPreset } from "@/components/workspace/workspace-selector-presets";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import { ServiceFieldItem } from "@/components/services/form-ui/service-field";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import type { BlastForm } from "./page";
import { DatabaseSelector } from "./database-selector";
import { OptionSelect } from "./option-select";

interface ParametersProps {
  form: BlastForm;
  database: BlastFormData["db_precomputed_database"];
  dbPreset: WorkspaceSelectorPreset;
  databaseTypes: readonly { label: string; value: string }[];
  outputPath: string;
  showAdvanced: boolean;
  setShowAdvanced: (open: boolean) => void;
  onDatabaseChange: (
    database: BlastFormData["db_precomputed_database"],
  ) => void;
  onOutputValidationChange: (valid: boolean) => void;
}

export function BlastParameters({
  form,
  database,
  dbPreset,
  databaseTypes,
  outputPath,
  showAdvanced,
  setShowAdvanced,
  onDatabaseChange,
  onOutputValidationChange,
}: ParametersProps) {
  return (
    <Card>
      <ServiceCardHeader>
        <ServiceCardTitle>Parameters</ServiceCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        <div className="service-card-row">
          <form.Field name="db_precomputed_database">
            {(field) => (
              <FieldItem className="w-full">
                <RequiredFormLabelInfo
                  label="Database Source"
                  infoPopup={blastServiceDatabaseSource}
                />
                <OptionSelect
                  label="Database Source"
                  value={field.state.value}
                  options={blastPrecomputedDatabases}
                  onChange={(value) => {
                    field.handleChange(
                      value as BlastFormData["db_precomputed_database"],
                    );
                    onDatabaseChange(
                      value as BlastFormData["db_precomputed_database"],
                    );
                  }}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <form.Field name="db_type">
            {(field) => (
              <FieldItem className="w-full">
                <RequiredFormLabelInfo
                  label="Database Type"
                  infoPopup={blastServiceDatabaseType}
                />
                <OptionSelect
                  label="Database Type"
                  value={field.state.value}
                  options={databaseTypes}
                  onChange={(value) => {
                    field.handleChange(value as BlastFormData["db_type"]);
                  }}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
        </div>
        <DatabaseSelector form={form} database={database} preset={dbPreset} />
        <div className="service-card-row">
          <form.Field name="output_path">
            {(field) => (
              <ServiceFieldItem>
                <OutputFolder
                  required
                  value={field.state.value}
                  onChange={field.handleChange}
                />
                <FieldErrors field={field} />
              </ServiceFieldItem>
            )}
          </form.Field>
          <form.Field name="output_file">
            {(field) => (
              <ServiceFieldItem>
                <OutputFolder
                  variant="name"
                  required
                  value={field.state.value}
                  onChange={field.handleChange}
                  outputFolderPath={outputPath}
                  onValidationChange={onOutputValidationChange}
                />
                <FieldErrors field={field} />
              </ServiceFieldItem>
            )}
          </form.Field>
        </div>
        <ServiceCollapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <ServiceCollapsibleTrigger>
            Advanced Options
            <ChevronDown
              className={`size-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
            />
          </ServiceCollapsibleTrigger>
          <ServiceCollapsibleContent>
            <div className="service-card-content-grid">
              <form.Field name="blast_max_hits">
                {(field) => (
                  <FieldItem>
                    <ServiceLabel>Max Hits</ServiceLabel>
                    <OptionSelect
                      label="Max Hits"
                      value={field.state.value}
                      options={maxHitsOptionsBlast}
                      onChange={field.handleChange}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
              <form.Field name="blast_evalue_cutoff">
                {(field) => (
                  <FieldItem>
                    <ServiceLabel>
                      E-Value Threshold
                    </ServiceLabel>
                    <OptionSelect
                      label="E-Value Threshold"
                      value={field.state.value}
                      options={evalueOptionsBlast}
                      onChange={field.handleChange}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </div>
          </ServiceCollapsibleContent>
        </ServiceCollapsible>
      </ServiceCardContent>
    </Card>
  );
}
