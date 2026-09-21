"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ServiceOutputFields } from "@/components/services/service-output-fields";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
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
        <CardHeader className="service-card-header">
          <RequiredFormCardTitle className="service-card-title">
            Alignment Parameters
            <DialogInfoPopup {...phylogeneticTreeAlignmentParameters} />
          </RequiredFormCardTitle>
        </CardHeader>
        <CardContent className="service-card-content">
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="service-card-header">
          <RequiredFormCardTitle className="service-card-title">
            Tree Parameters
            <DialogInfoPopup {...phylogeneticTreeTreeParameters} />
          </RequiredFormCardTitle>
        </CardHeader>
        <CardContent className="service-card-content">
          <div className="space-y-4">
            <form.Field name="recipe">
              {(field) => (
                <FieldItem>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value != null) {
                        field.handleChange(
                          value as ViralGenomeTree.ViralGenomeTreeFormData["recipe"],
                        );
                      }
                    }}
                    className="service-radio-group-horizontal"
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
                  </RadioGroup>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
            <form.Field name="substitution_model">
              {(field) => (
                <FieldItem>
                  <Label className="service-card-label">Model</Label>
                  <Select
                    items={ViralGenomeTree.dnaModels}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value != null) field.handleChange(value);
                    }}
                  >
                    <SelectTrigger
                      id="model"
                      className="service-card-select-trigger"
                      aria-label="Substitution model"
                    >
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
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
        </CardContent>
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
          <Label className="service-card-label">{label}</Label>
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
            <SelectTrigger
              className="service-card-select-trigger"
              aria-label={ariaLabel}
            >
              <SelectValue placeholder="Select" />
            </SelectTrigger>
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
