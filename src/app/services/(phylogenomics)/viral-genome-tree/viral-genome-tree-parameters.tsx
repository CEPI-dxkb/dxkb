"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ServiceOutputFields } from "@/components/services/service-output-fields";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import {
  phylogeneticTreeAlignmentParameters,
  phylogeneticTreeTreeParameters,
} from "@/lib/services/info/phylogenetic-tree";
import * as ViralGenomeTree from "@/lib/forms/(phylogenomics)/viral-genome-tree/viral-genome-tree-form-schema";
import type { ViralGenomeTreeController } from "./use-viral-genome-tree";

export function ViralGenomeTreeParameters({
  controller,
}: {
  controller: ViralGenomeTreeController;
}) {
  const { form, setIsOutputNameValid } = controller;
  return (
    <div className="space-y-4">
      <Card>
        <ServiceCardHeader>
          <RequiredFormCardTitle>
            Alignment Parameters
            <DialogInfoPopup {...phylogeneticTreeAlignmentParameters} />
          </RequiredFormCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="space-y-4">
            <ThresholdField
              form={form}
              name="trim_threshold"
              label="Trim Ends of Alignment Threshold"
              ariaLabel="Trim ends of alignment threshold"
            />
            <ThresholdField
              form={form}
              name="gap_threshold"
              label="Remove Gappy Sequences Threshold"
              ariaLabel="Remove gappy sequences threshold"
            />
          </div>
        </ServiceCardContent>
      </Card>
      <Card>
        <ServiceCardHeader>
          <RequiredFormCardTitle>
            Tree Parameters
            <DialogInfoPopup {...phylogeneticTreeTreeParameters} />
          </RequiredFormCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="space-y-4">
            <form.Field name="recipe">
              {(field) => (
                <FieldItem>
                  <ServiceRadioGroup
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value != null) {
                        field.handleChange(
                          value as ViralGenomeTree.ViralGenomeTreeFormData["recipe"],
                        );
                      }
                    }}
                  >
                    {(["RAxML", "PhyML", "FastTree"] as const).map((recipe) => (
                      <div key={recipe} className="flex items-center gap-3">
                        <RadioGroupItem
                          value={recipe}
                          id={recipe.toLowerCase()}
                        />
                        <Label htmlFor={recipe.toLowerCase()}>{recipe}</Label>
                      </div>
                    ))}
                  </ServiceRadioGroup>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
            <form.Field name="substitution_model">
              {(field) => (
                <FieldItem>
                  <ServiceLabel>Model</ServiceLabel>
                  <Select
                    items={ViralGenomeTree.dnaModels}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value != null) field.handleChange(value);
                    }}
                  >
                    <ServiceSelectTrigger
                      id="model"
                      aria-label="Substitution model"
                    >
                      <SelectValue placeholder="Select" />
                    </ServiceSelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ViralGenomeTree.dnaModels.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
            <form.Field name="output_path">
              {(outputPathField) => (
                <form.Field name="output_file">
                  {(outputNameField) => (
                    <ServiceOutputFields
                      outputPath={{
                        value: outputPathField.state.value,
                        onChange: outputPathField.handleChange,
                        errors: <FieldErrors field={outputPathField} />,
                      }}
                      outputName={{
                        value: outputNameField.state.value,
                        onChange: outputNameField.handleChange,
                        errors: <FieldErrors field={outputNameField} />,
                      }}
                      onOutputNameValidationChange={setIsOutputNameValid}
                    />
                  )}
                </form.Field>
              )}
            </form.Field>
          </div>
        </ServiceCardContent>
      </Card>
    </div>
  );
}

function ThresholdField({
  form,
  name,
  label,
  ariaLabel,
}: {
  form: ViralGenomeTreeController["form"];
  name: "trim_threshold" | "gap_threshold";
  label: string;
  ariaLabel: string;
}) {
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldItem>
          <ServiceLabel>{label}</ServiceLabel>
          <Select
            items={ViralGenomeTree.thresholdOptions.map((value) => ({
              value,
              label: value,
            }))}
            value={field.state.value}
            onValueChange={(value) => {
              if (value != null) field.handleChange(value);
            }}
          >
            <ServiceSelectTrigger aria-label={ariaLabel}>
              <SelectValue placeholder="Select" />
            </ServiceSelectTrigger>
            <SelectContent>
              <SelectGroup>
                {ViralGenomeTree.thresholdOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <FieldErrors field={field} />
        </FieldItem>
      )}
    </form.Field>
  );
}
