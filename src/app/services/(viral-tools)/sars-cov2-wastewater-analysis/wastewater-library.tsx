import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { Card, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { sarsCov2WastewaterAnalysisInputLib } from "@/lib/services/info/sars-cov2-wastewater-analysis";
import { primerOptions } from "@/lib/forms/(viral-tools)/sars-cov2-wastewater-analysis/sars-cov2-wastewater-analysis-form-schema";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { Library } from "@/types/services";
import type { WastewaterForm } from "./page";

interface WastewaterLibraryPage {
  form: WastewaterForm;
  pairedRead1: string | null;
  pairedRead2: string | null;
  singleRead: string | null;
  currentSampleId: string;
  currentSampleDate: string;
  sraResetKey: number;
  selectedLibraries: Library[];
  primerVersionOpts: { value: string; label: string }[];
  setPairedRead2: (value: string | null) => void;
  setCurrentSampleId: (value: string) => void;
  setCurrentSampleDate: (value: string) => void;
  handlePairedRead1Select: (path: string) => void;
  handleSingleReadSelect: (path: string) => void;
  handlePairedLibraryAdd: () => void;
  handleSingleLibraryAdd: () => void;
  handleSetSelectedLibraries: (libraries: Library[]) => void;
  handleSraAccessionChange: (value: string) => void;
}

export function WastewaterLibrary({
  page,
}: {
  page: WastewaterLibraryPage;
}) {
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Input Library Selection
          <DialogInfoPopup
            title={sarsCov2WastewaterAnalysisInputLib.title}
            description={sarsCov2WastewaterAnalysisInputLib.description}
            sections={sarsCov2WastewaterAnalysisInputLib.sections}
          />
        </RequiredFormCardTitle>
        <CardDescription className="text-xs">
          Send to selected libraries using the arrow buttons.
        </CardDescription>
      </ServiceCardHeader>
      <ServiceCardContent className="space-y-6">
        <ReadInput
          label="Paired Read Library"
          disabled={!page.pairedRead1 || !page.pairedRead2}
          onAdd={page.handlePairedLibraryAdd}
        >
          <div className="space-y-3">
            <WorkspaceObjectSelector
              preset="reads"
              placeholder="Select READ FILE 1..."
              value={page.pairedRead1 ?? ""}
              onObjectSelect={(object: WorkspaceObject) => {
                page.handlePairedRead1Select(object.path);
              }}
            />
            <WorkspaceObjectSelector
              preset="reads"
              placeholder="Select READ FILE 2..."
              value={page.pairedRead2 ?? ""}
              onObjectSelect={(object: WorkspaceObject) => {
                page.setPairedRead2(object.path);
              }}
            />
          </div>
        </ReadInput>
        <ReadInput
          label="Single Read Library"
          disabled={!page.singleRead}
          onAdd={page.handleSingleLibraryAdd}
        >
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE..."
            value={page.singleRead ?? ""}
            onObjectSelect={(object: WorkspaceObject) => {
              page.handleSingleReadSelect(object.path);
            }}
          />
        </ReadInput>
        <SraRunAccessionWithValidation
          key={page.sraResetKey}
          title="SRA Run Accession"
          placeholder="SRR..."
          selectedLibraries={page.selectedLibraries}
          setSelectedLibraries={page.handleSetSelectedLibraries}
          allowDuplicates={false}
          onChange={page.handleSraAccessionChange}
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <div className="flex-1 space-y-2">
            <ServiceLabel>Primers</ServiceLabel>
            <page.form.Field name="primers">
              {(field) => (
                <FieldItem>
                  <Select
                    items={primerOptions}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value != null) field.handleChange(value);
                    }}
                  >
                    <ServiceSelectTrigger aria-label="Primers">
                      <SelectValue placeholder="Select primers" />
                    </ServiceSelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {primerOptions.map((primer) => (
                          <SelectItem key={primer.value} value={primer.value}>
                            {primer.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </page.form.Field>
          </div>
          <div className="w-full space-y-2 sm:w-32">
            <ServiceLabel>Version</ServiceLabel>
            <page.form.Field name="primer_version">
              {(field) => (
                <FieldItem>
                  <Select
                    items={page.primerVersionOpts}
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value != null) field.handleChange(value);
                    }}
                  >
                    <ServiceSelectTrigger aria-label="Version">
                      <SelectValue placeholder="Version" />
                    </ServiceSelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {page.primerVersionOpts.map((version) => (
                          <SelectItem key={version.value} value={version.value}>
                            {version.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </page.form.Field>
          </div>
        </div>
        <div className="space-y-2">
          <ServiceLabel>Sample Identifier</ServiceLabel>
          <ServiceInput
            placeholder="SAMPLE ID"
            value={page.currentSampleId}
            onChange={(event) => {
              page.setCurrentSampleId(event.target.value);
            }}
          />
        </div>
        <div className="space-y-2">
          <ServiceLabel>Sample Date (optional)</ServiceLabel>
          <ServiceInput
            placeholder="MM/DD/YYYY"
            value={page.currentSampleDate}
            onChange={(event) => {
              page.setCurrentSampleDate(event.target.value);
            }}
          />
        </div>
        <page.form.Field name="paired_end_libs">
          {(field) => (
            <FieldItem>
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </page.form.Field>
      </ServiceCardContent>
    </Card>
  );
}
function ReadInput({
  label,
  disabled,
  onAdd,
  children,
}: {
  label: string;
  disabled: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <ServiceLabel>{label}</ServiceLabel>
        <div className="mx-4 h-px flex-1 bg-border" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Add ${label.toLowerCase()}`}
          onClick={onAdd}
          disabled={disabled}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      {children}
    </div>
  );
}
