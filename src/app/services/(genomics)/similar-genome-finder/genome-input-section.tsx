"use client";

import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import { ServiceFieldLabel } from "@/components/services/form-ui/service-field";
import { similarGenomeFinderSelectGenome } from "@/lib/services/info/similar-genome-finder";
import type { SimilarGenomeFinderController } from "./use-similar-genome-finder-form";

export function GenomeInputSection({
  controller,
  children,
}: {
  controller: SimilarGenomeFinderController;
  children: React.ReactNode;
}) {
  const { form, showAdvanced, setShowAdvanced } = controller;
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Select a Genome
          <DialogInfoPopup
            title={similarGenomeFinderSelectGenome.title}
            description={similarGenomeFinderSelectGenome.description}
            sections={similarGenomeFinderSelectGenome.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent className="space-y-6">
        <form.Field name="selectedGenomeId">
          {(field) => (
            <FieldItem>
              <ServiceFieldLabel field={field}>
                Search by Genome Name or Genome ID
              </ServiceFieldLabel>
              <SingleGenomeSelector
                id={field.name}
                placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                value={field.state.value}
                onChange={(value) => {
                  field.handleChange(value);
                  if (value.trim()) form.setFieldValue("fasta_file", "");
                }}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
        <form.Field name="fasta_file">
          {(field) => (
            <FieldItem>
              <ServiceFieldLabel field={field}>
                Or Upload FASTA/FASTQ
              </ServiceFieldLabel>
              <WorkspaceObjectSelector
                id={field.name}
                preset="contigsOrReads"
                placeholder="Select a FASTA/FASTQ file..."
                value={field.state.value}
                onSelectedObjectChange={(object) => {
                  field.handleChange(object?.path ?? "");
                  if (object) form.setFieldValue("selectedGenomeId", "");
                }}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
        <ServiceCollapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <ServiceCollapsibleTrigger>
            Advanced Options
            <ChevronDown
              className={`size-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
            />
          </ServiceCollapsibleTrigger>
          <ServiceCollapsibleContent>
            {children}
          </ServiceCollapsibleContent>
        </ServiceCollapsible>
      </ServiceCardContent>
    </Card>
  );
}
