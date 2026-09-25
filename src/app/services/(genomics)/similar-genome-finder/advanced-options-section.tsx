"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ServiceFieldSubLabel } from "@/components/services/form-ui/service-field";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import {
  distanceOptions,
  maxHitsOptions,
  pValueOptions,
} from "@/lib/forms/(genomics)/similar-genome-finder/similar-genome-finder-form-schema";
import { similarGenomeFinderAdvancedParameters } from "@/lib/services/info/similar-genome-finder";
import type { SimilarGenomeFinderController } from "./use-similar-genome-finder-form";

export function AdvancedOptionsSection({
  controller,
}: {
  controller: SimilarGenomeFinderController;
}) {
  const { form } = controller;
  return (
    <div className="flex w-full flex-col justify-between space-y-4">
      <div className="flex items-center">
        <ServiceLabel>Parameters</ServiceLabel>
        <DialogInfoPopup
          title={similarGenomeFinderAdvancedParameters.title}
          description={similarGenomeFinderAdvancedParameters.description}
          sections={similarGenomeFinderAdvancedParameters.sections}
          className="mb-2 ml-2"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <form.Field name="max_hits">
          {(field) => (
            <FieldItem>
              <ServiceFieldSubLabel field={field}>
                Max Hits
              </ServiceFieldSubLabel>
              <Select
                items={maxHitsOptions}
                value={field.state.value.toString()}
                onValueChange={(value) => {
                  if (value != null) field.handleChange(parseInt(value, 10));
                }}
              >
                <ServiceSelectTrigger>
                  <SelectValue placeholder="Select max hits" />
                </ServiceSelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {maxHitsOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={String(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
        <form.Field name="max_pvalue">
          {(field) => (
            <FieldItem>
              <ServiceFieldSubLabel field={field}>
                P-Value Threshold
              </ServiceFieldSubLabel>
              <Select
                items={pValueOptions}
                value={field.state.value.toString()}
                onValueChange={(value) => {
                  if (value != null) field.handleChange(parseFloat(value));
                }}
              >
                <ServiceSelectTrigger>
                  <SelectValue placeholder="Select P-value" />
                </ServiceSelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {pValueOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={String(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
        <form.Field name="max_distance">
          {(field) => (
            <FieldItem>
              <ServiceFieldSubLabel field={field}>
                Distance
              </ServiceFieldSubLabel>
              <Select
                items={distanceOptions}
                value={field.state.value.toString()}
                onValueChange={(value) => {
                  if (value != null) field.handleChange(parseFloat(value));
                }}
              >
                <ServiceSelectTrigger>
                  <SelectValue placeholder="Select distance" />
                </ServiceSelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {distanceOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={String(option.value)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <ServiceLabel>Organism Type</ServiceLabel>
          <form.Field name="include_bacterial">
            {(field) => (
              <FieldItem className="flex flex-row items-center space-y-0 space-x-2">
                <Checkbox
                  id="include_bacterial"
                  name="include_bacterial"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
                <Label
                  htmlFor="include_bacterial"
                  className="text-sm font-normal"
                >
                  Bacterial and Archaeal Genomes
                </Label>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <form.Field name="include_viral">
            {(field) => (
              <FieldItem className="flex flex-row items-center space-y-0 space-x-2">
                <Checkbox
                  id="include_viral"
                  name="include_viral"
                  checked={field.state.value}
                  onCheckedChange={field.handleChange}
                />
                <Label htmlFor="include_viral" className="text-sm font-normal">
                  Viral Genomes
                </Label>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
        </div>
        <div className="flex flex-col gap-2">
          <ServiceLabel>Scope</ServiceLabel>
          <form.Field name="scope">
            {(field) => (
              <FieldItem>
                <RadioGroup
                  value={field.state.value}
                  onValueChange={(value) =>
                    { field.handleChange(value as "reference" | "all"); }
                  }
                  className="grid w-full gap-2"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="reference" id="reference" />
                    <Label htmlFor="reference" className="text-sm font-normal">
                      Reference and Representative Genomes
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="all" id="all" />
                    <Label htmlFor="all" className="text-sm font-normal">
                      All Public Genomes
                    </Label>
                  </div>
                </RadioGroup>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
        </div>
      </div>
    </div>
  );
}
