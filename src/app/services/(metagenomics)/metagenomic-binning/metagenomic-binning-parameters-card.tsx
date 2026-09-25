"use client";

import { ChevronDown } from "lucide-react";
import type { MetagenomicBinningController } from "./use-metagenomic-binning-controller";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { ServiceCardHeader } from "@/components/services/form-ui/service-card";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import {
  ServiceFieldLabel,
  ServiceFieldSubLabel,
} from "@/components/services/form-ui/service-field";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import {
  minContigCoverageMax,
  minContigCoverageMin,
  minContigLengthMax,
  minContigLengthMin,
  type MetagenomicBinningFormData,
} from "@/lib/forms/(metagenomics)/metagenomic-binning/metagenomic-binning-form-schema";
import { metagenomicBinningParameters } from "@/lib/services/info/metagenomic-binning";

export function BinningParametersCard({
  controller,
}: {
  controller: MetagenomicBinningController;
}) {
  const { form, state, setState, startWith, outputPath, metaspadesDisabled } =
    controller;
  return (
    <div className="md:col-span-12">
      <Card>
        <ServiceCardHeader>
          <RequiredFormCardTitle>
            Parameters
            <DialogInfoPopup
              title={metagenomicBinningParameters.title}
              description={metagenomicBinningParameters.description}
              sections={metagenomicBinningParameters.sections}
            />
          </RequiredFormCardTitle>
        </ServiceCardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex w-full flex-col gap-4 md:flex-row">
              {startWith === "reads" && (
                <div className="w-full">
                  <form.Field name="assembler">
                    {(field) => (
                      <FieldItem>
                        <ServiceFieldLabel field={field}>
                          Assembly Strategy
                        </ServiceFieldLabel>
                        <ServiceRadioGroup
                          value={field.state.value}
                          onValueChange={(value) => {
                            if (value != null)
                              field.handleChange(
                                value as MetagenomicBinningFormData["assembler"],
                              );
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem
                              value="metaspades"
                              id="metaspades"
                              disabled={metaspadesDisabled}
                            />
                            <Label
                              htmlFor="metaspades"
                              className={`text-sm ${metaspadesDisabled ? "text-muted-foreground" : ""}`}
                            >
                              MetaSPAdes
                            </Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="megahit" id="megahit" />
                            <Label htmlFor="megahit" className="text-sm">
                              MEGAHIT
                            </Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="auto" id="auto" />
                            <Label htmlFor="auto" className="text-sm">
                              Auto
                            </Label>
                          </div>
                        </ServiceRadioGroup>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              )}
              <div className="w-full">
                <form.Field name="organism">
                  {(field) => (
                    <FieldItem>
                      <ServiceFieldLabel field={field}>
                        Organisms of Interest
                      </ServiceFieldLabel>
                      <ServiceRadioGroup
                        value={field.state.value}
                        onValueChange={(value) => {
                          if (value != null)
                            field.handleChange(
                              value as MetagenomicBinningFormData["organism"],
                            );
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="bacteria" id="bacteria" />
                          <Label htmlFor="bacteria" className="text-sm">
                            Bacteria/Archaea
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="viral" id="viral" />
                          <Label htmlFor="viral" className="text-sm">
                            Viruses
                          </Label>
                        </div>
                        <div className="flex items-center gap-3">
                          <RadioGroupItem value="both" id="both" />
                          <Label htmlFor="both" className="text-sm">
                            Both
                          </Label>
                        </div>
                      </ServiceRadioGroup>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </div>
            </div>
            <div className="mt-4 space-y-6">
              <div className="flex flex-col space-y-4">
                <form.Field name="output_path">
                  {(field) => (
                    <FieldItem className="w-full">
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
                    <FieldItem className="w-full">
                      <OutputFolder
                        variant="name"
                        required
                        value={field.state.value}
                        onChange={field.handleChange}
                        outputFolderPath={outputPath}
                        onValidationChange={setState("isOutputNameValid")}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </div>
              <form.Field name="genome_group">
                {(field) => (
                  <FieldItem>
                    <ServiceFieldLabel field={field}>
                      Genome Group Name
                    </ServiceFieldLabel>
                    <ServiceInput
                      name={field.name}
                      value={field.state.value ?? ""}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      onBlur={field.handleBlur}
                      placeholder="My Genome Group"
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </div>
            <ServiceCollapsible
              open={state.showAdvanced}
              onOpenChange={setState("showAdvanced")}
            >
              <ServiceCollapsibleTrigger className="text-sm font-medium">
                Advanced Parameters
                <ChevronDown
                  className={`size-4 transition-transform ${state.showAdvanced ? "rotate-180 transform" : ""}`}
                />
              </ServiceCollapsibleTrigger>
              <ServiceCollapsibleContent>
                <div className="mt-6 space-y-4">
                  <div className="service-card-row">
                    <form.Field name="min_contig_len">
                      {(field) => (
                        <FieldItem className="w-full">
                          <ServiceFieldSubLabel field={field}>
                            Minimum Contig Length
                          </ServiceFieldSubLabel>
                          <NumberInput
                            name={field.name}
                            value={field.state.value}
                            min={minContigLengthMin}
                            max={minContigLengthMax}
                            stepper={10}
                            onBlur={field.handleBlur}
                            onValueChange={(value) => {
                              if (value !== undefined)
                                field.handleChange(value);
                            }}
                          />
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                    <form.Field name="min_contig_cov">
                      {(field) => (
                        <FieldItem className="w-full">
                          <ServiceFieldSubLabel field={field}>
                            Minimum Contig Coverage
                          </ServiceFieldSubLabel>
                          <NumberInput
                            name={field.name}
                            value={field.state.value}
                            min={minContigCoverageMin}
                            max={minContigCoverageMax}
                            stepper={1}
                            onBlur={field.handleBlur}
                            onValueChange={(value) => {
                              if (value !== undefined)
                                field.handleChange(value);
                            }}
                          />
                          <FieldErrors field={field} />
                        </FieldItem>
                      )}
                    </form.Field>
                  </div>
                  <form.Field name="disable_dangling">
                    {(field) => (
                      <FieldItem className="flex items-center gap-2">
                        <Checkbox
                          id="disable_dangling"
                          name="disable_dangling"
                          checked={field.state.value}
                          onCheckedChange={field.handleChange}
                          className="mb-2 bg-background"
                        />
                        <ServiceFieldSubLabel
                          field={field}
                          htmlFor="disable_dangling"
                        >
                          Disable Search For Dangling Contigs (Decreases Memory
                          Use)
                        </ServiceFieldSubLabel>
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </ServiceCollapsibleContent>
            </ServiceCollapsible>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
