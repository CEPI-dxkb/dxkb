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
import { ServiceFieldLabel } from "@/components/services/form-ui/service-field";
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
    <div className="service-card-content-grid">
      <div className="flex items-center md:col-span-2">
        <ServiceLabel>Parameters</ServiceLabel>
        <DialogInfoPopup
          title={similarGenomeFinderAdvancedParameters.title}
          description={similarGenomeFinderAdvancedParameters.description}
          sections={similarGenomeFinderAdvancedParameters.sections}
          className="mb-2 ml-2"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:col-span-2">
        <form.Field name="max_hits">
          {(field) => (
            <FieldItem>
              <ServiceFieldLabel field={field}>
                Max Hits
              </ServiceFieldLabel>
              <Select
                items={maxHitsOptions}
                value={field.state.value.toString()}
                onValueChange={(value) => {
                  if (value != null) field.handleChange(parseInt(value, 10));
                }}
              >
                <ServiceSelectTrigger id={field.name}>
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
              <ServiceFieldLabel field={field}>
                P-Value Threshold
              </ServiceFieldLabel>
              <Select
                items={pValueOptions}
                value={field.state.value.toString()}
                onValueChange={(value) => {
                  if (value != null) field.handleChange(parseFloat(value));
                }}
              >
                <ServiceSelectTrigger id={field.name}>
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
              <ServiceFieldLabel field={field}>
                Distance
              </ServiceFieldLabel>
              <Select
                items={distanceOptions}
                value={field.state.value.toString()}
                onValueChange={(value) => {
                  if (value != null) field.handleChange(parseFloat(value));
                }}
              >
                <ServiceSelectTrigger id={field.name}>
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
      <div className="service-card-content-col">
        <ServiceLabel>Organism Type</ServiceLabel>
        <form.Field name="include_bacterial">
          {(bacterial) => (
            <>
              <FieldItem className="flex flex-row items-center">
                <Checkbox
                  id="include_bacterial"
                  name="include_bacterial"
                  checked={bacterial.state.value}
                  onCheckedChange={bacterial.handleChange}
                  className="mr-2"
                />
                <Label htmlFor="include_bacterial">
                  Bacterial and Archaeal Genomes
                </Label>
              </FieldItem>
              <form.Field name="include_viral">
                {(viral) => (
                  <FieldItem className="flex flex-row items-center">
                    <Checkbox
                      id="include_viral"
                      name="include_viral"
                      checked={viral.state.value}
                      onCheckedChange={viral.handleChange}
                      className="mr-2"
                    />
                    <Label htmlFor="include_viral">Viral Genomes</Label>
                  </FieldItem>
                )}
              </form.Field>
              <FieldErrors field={bacterial} />
            </>
          )}
        </form.Field>
      </div>
      <div className="service-card-content-col">
        <ServiceLabel>Scope</ServiceLabel>
        <form.Field name="scope">
          {(field) => (
            <FieldItem>
              <RadioGroup
                value={field.state.value}
                onValueChange={(value) =>
                  { field.handleChange(value as "reference" | "all"); }
                }
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="reference" id="reference" />
                  <Label htmlFor="reference">
                    Reference and Representative Genomes
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">All Public Genomes</Label>
                </div>
              </RadioGroup>
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
      </div>
    </div>
  );
}
