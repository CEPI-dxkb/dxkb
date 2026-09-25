import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { SingleGenomeSelector } from "@/components/services/single-genome-selector";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import {
  fastqUtilitiesParameters,
  fastqUtilitiesPipeline,
} from "@/lib/services/info/fastq-utilities";
import {
  maxPipelineActions,
  pipelineActionOptions,
} from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-form-schema";
import type { useFastqUtilitiesPage } from "./use-fastq-utilities-page";

type Page = ReturnType<typeof useFastqUtilitiesPage>;

export function FastqOutputCard({ page }: { page: Page }) {
  return (
    <Card className="h-full">
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Parameters
          <DialogInfoPopup
            title={fastqUtilitiesParameters.title}
            sections={fastqUtilitiesParameters.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        <page.form.Field name="output_path">
          {(field) => (
            <FieldItem className="w-full">
              <OutputFolder
                value={field.state.value}
                onChange={field.handleChange}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </page.form.Field>
        <page.form.Field name="output_file">
          {(field) => (
            <FieldItem className="w-full">
              <OutputFolder
                variant="name"
                value={field.state.value}
                onChange={field.handleChange}
                outputFolderPath={page.outputPath}
                onValidationChange={page.setIsOutputNameValid}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </page.form.Field>
      </ServiceCardContent>
    </Card>
  );
}

export function FastqPipelineCard({ page }: { page: Page }) {
  return (
    <Card className="h-full">
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Pipeline
          <DialogInfoPopup
            title={fastqUtilitiesPipeline.title}
            sections={fastqUtilitiesPipeline.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        <div>
          <ServiceLabel>Select Action</ServiceLabel>
          <div className="flex items-center gap-2">
            <Select
              items={pipelineActionOptions}
              value={page.selectedAction}
              onValueChange={(value) => {
                if (value != null) page.setSelectedAction(value);
              }}
            >
              <ServiceSelectTrigger aria-label="Select action">
                <SelectValue placeholder="Select Action" />
              </ServiceSelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {pipelineActionOptions.map((action) => (
                    <SelectItem key={action.value} value={action.value}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Add pipeline action"
              onClick={page.handleAddPipelineAction}
              disabled={
                !page.selectedAction ||
                page.pipelineActions.length >= maxPipelineActions
              }
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {page.pipelineActions.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No actions added yet
            </p>
          ) : (
            page.pipelineActions.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`size-3 rounded-full ${action.color ?? ""}`}
                  />
                  <span className="text-sm">{action.label}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Remove ${action.label} action`}
                  onClick={() => {
                    page.handleRemovePipelineAction(action.id);
                  }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))
          )}
        </div>
        <page.form.Field name="recipe">
          {(field) => (
            <FieldItem>
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </page.form.Field>
        <div className="pt-4">
          <page.form.Field name="reference_genome_id">
            {(field) => (
              <FieldItem>
                <SingleGenomeSelector
                  title="Target Genome"
                  placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                  value={field.state.value || ""}
                  onChange={field.handleChange}
                  disabled={!page.alignSelected}
                  helperText={
                    page.alignSelected
                      ? undefined
                      : "Add the Align action to enable genome selection."
                  }
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </page.form.Field>
        </div>
      </ServiceCardContent>
    </Card>
  );
}
