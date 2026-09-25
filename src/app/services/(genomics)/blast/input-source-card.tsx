import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { FastaTextarea } from "@/components/services/fasta-textarea";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { blastServiceInputSource } from "@/lib/services/info/blast";
import type { BlastFormData } from "@/lib/forms/(genomics)/blast/blast-form-schema";
import type { FastaValidationResult } from "@/lib/fasta-validation";
import type { WorkspaceSelectorPreset } from "@/components/workspace/workspace-selector-presets";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import type { BlastForm } from "./page";
import { Choice } from "./choice";

interface InputProps {
  form: BlastForm;
  source: BlastFormData["input_source"];
  program: BlastFormData["blast_program"];
  preset: WorkspaceSelectorPreset;
  onSourceChange: (source: BlastFormData["input_source"]) => void;
  onValidationChange: (
    valid: boolean,
    result: FastaValidationResult | null,
  ) => void;
}

export function InputSourceCard({
  form,
  source,
  program,
  preset,
  onSourceChange,
  onValidationChange,
}: InputProps) {
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Input Source
          <DialogInfoPopup
            title={blastServiceInputSource.title}
            description={blastServiceInputSource.description}
            sections={blastServiceInputSource.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        <form.Field name="input_source">
          {(field) => (
            <div className="space-y-6">
              <FieldItem>
                <ServiceRadioGroup
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value === null) return;
                    const source = value as BlastFormData["input_source"];
                    field.handleChange(source);
                    onSourceChange(source);
                  }}
                >
                  <Choice
                    value="fasta_data"
                    id="fastaSequence"
                    label="Enter sequence"
                  />
                  <Choice
                    value="fasta_file"
                    id="fastaFile"
                    label="Select FASTA file"
                  />
                  <Choice
                    value="feature_group"
                    id="featureGroup"
                    label="Select feature group"
                  />
                </ServiceRadioGroup>
                <FieldErrors field={field} />
              </FieldItem>
              {source === "fasta_data" && (
                <form.Field name="input_fasta_data">
                  {(item) => (
                    <FieldItem>
                      <FastaTextarea
                        value={item.state.value}
                        onChange={item.handleChange}
                        inputType={program}
                        onValidationChange={onValidationChange}
                        required
                        showValidationStatus
                      />
                      <FieldErrors field={item} />
                    </FieldItem>
                  )}
                </form.Field>
              )}
              {source === "fasta_file" && (
                <form.Field name="input_fasta_file">
                  {(item) => (
                    <FieldItem>
                      <WorkspaceObjectSelector
                        preset={preset}
                        placeholder="Select a FASTA file to search..."
                        value={item.state.value}
                        onSelectedObjectChange={(object) => {
                          item.handleChange(object?.path ?? "");
                        }}
                      />
                      <FieldErrors field={item} />
                    </FieldItem>
                  )}
                </form.Field>
              )}
              {source === "feature_group" && (
                <form.Field name="input_feature_group">
                  {(item) => (
                    <FieldItem>
                      <WorkspaceObjectSelector
                        preset="featureGroup"
                        placeholder="Select a feature group to search..."
                        value={item.state.value}
                        onSelectedObjectChange={(object) => {
                          item.handleChange(object?.path ?? "");
                        }}
                      />
                      <FieldErrors field={item} />
                    </FieldItem>
                  )}
                </form.Field>
              )}
            </div>
          )}
        </form.Field>
      </ServiceCardContent>
    </Card>
  );
}
