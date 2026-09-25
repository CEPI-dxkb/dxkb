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
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import { ServiceRequiredLabel } from "@/components/services/form-ui/service-required-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import {
  phylogeneticTreeAlignmentParameters,
  phylogeneticTreeTreeParameters,
} from "@/lib/services/info/phylogenetic-tree";
import {
  thresholdOptions,
  type GeneProteinTreeFormData,
} from "@/lib/forms/(protein-tools)/gene-protein-tree/gene-protein-tree-form-schema";
import type { GeneProteinTreeController } from "./use-gene-protein-tree";

export function GeneProteinTreeParameters({
  controller,
}: {
  controller: GeneProteinTreeController;
}) {
  const { form, outputPath, substitutionModelOptions, setIsOutputNameValid } =
    controller;
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
                          value as GeneProteinTreeFormData["recipe"],
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
                  <ServiceRequiredLabel>Model</ServiceRequiredLabel>
                  <Select
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
                        {substitutionModelOptions.map(
                          (model: { value: string; label: string }) => (
                            <SelectItem key={model.value} value={model.value}>
                              {model.label}
                            </SelectItem>
                          ),
                        )}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
            <div className="flex flex-col space-y-4">
              <form.Field name="output_path">
                {(field) => (
                  <FieldItem>
                    <OutputFolder
                      required
                      value={field.state.value}
                      onChange={field.handleChange}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
              <form.Field name="output_file">
                {(field) => (
                  <FieldItem>
                    <OutputFolder
                      variant="name"
                      required
                      value={field.state.value}
                      onChange={field.handleChange}
                      outputFolderPath={outputPath}
                      onValidationChange={setIsOutputNameValid}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </div>
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
  form: GeneProteinTreeController["form"];
  name: "trim_threshold" | "gap_threshold";
  label: string;
  ariaLabel: string;
}) {
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldItem>
          <ServiceRequiredLabel>
            {label}
          </ServiceRequiredLabel>
          <Select
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
                {thresholdOptions.map((value) => (
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
