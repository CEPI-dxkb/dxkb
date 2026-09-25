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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronRight, HelpCircle } from "lucide-react";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import SelectedItemsTable from "@/components/services/selected-items-table";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import {
  ServiceLabel,
  ServiceSubLabel,
} from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { readInputFileInfo } from "@/lib/services/info/sars-cov2-genome-analysis";
import { getLibraryTypeLabel } from "@/lib/forms/shared-schemas";
import {
  sarsCov2PairedPlatformOptions,
  sarsCov2SinglePlatformOptions,
  type SarsCov2Platform,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { Library } from "@/types/services";
import type { SarsGenomeForm } from "./page";

interface SarsGenomePage {
  form: SarsGenomeForm;
  pairedRead1: string | null;
  pairedRead2: string | null;
  pairedPlatform: SarsCov2Platform;
  singleRead: string | null;
  singlePlatform: SarsCov2Platform;
  sraResetKey: number;
  selectedLibraries: Library[];
  setPairedRead1: (value: string | null) => void;
  setPairedRead2: (value: string | null) => void;
  setPairedPlatform: (value: SarsCov2Platform) => void;
  setSingleRead: (value: string | null) => void;
  setSinglePlatform: (value: SarsCov2Platform) => void;
  setLibraries: (value: Library[]) => void;
  removeLibrary: (id: string) => void;
  handlePairedLibraryAdd: () => void;
  handleSingleLibraryAdd: () => void;
}

export function SarsGenomeReadInputs({ page }: { page: SarsGenomePage }) {
  return (
    <>
      <div className="md:col-span-6">
        <Card>
          <ServiceCardHeader>
            <RequiredFormCardTitle>
              Input Library
              <DialogInfoPopup
                title={readInputFileInfo.title}
                description={readInputFileInfo.description}
                sections={readInputFileInfo.sections}
              />
            </RequiredFormCardTitle>
          </ServiceCardHeader>
          <ServiceCardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <ServiceLabel>Paired Read Library</ServiceLabel>
                <div className="mx-4 h-px flex-1 bg-border" />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Add paired read library"
                  onClick={page.handlePairedLibraryAdd}
                  disabled={!page.pairedRead1 || !page.pairedRead2}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
              <div className="space-y-3">
                <WorkspaceObjectSelector
                  preset="reads"
                  placeholder="Select READ FILE 1..."
                  value={page.pairedRead1 ?? ""}
                  onObjectSelect={(object: WorkspaceObject) => {
                    page.setPairedRead1(object.path);
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
              <PlatformSelect
                label="Platform"
                value={page.pairedPlatform}
                options={sarsCov2PairedPlatformOptions}
                onChange={page.setPairedPlatform}
              />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <ServiceLabel>Single Read Library</ServiceLabel>
                  <div className="mx-4 h-px flex-1 bg-border" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Add single read library"
                    onClick={page.handleSingleLibraryAdd}
                    disabled={!page.singleRead}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <WorkspaceObjectSelector
                  preset="reads"
                  placeholder="Select READ FILE..."
                  value={page.singleRead ?? ""}
                  onObjectSelect={(object: WorkspaceObject) => {
                    page.setSingleRead(object.path);
                  }}
                />
                <PlatformSelect
                  label="Platform"
                  value={page.singlePlatform}
                  options={sarsCov2SinglePlatformOptions}
                  onChange={page.setSinglePlatform}
                />
              </div>
            </div>
            <SraRunAccessionWithValidation
              key={page.sraResetKey}
              title="SRA Run Accession"
              placeholder="SRR..."
              selectedLibraries={page.selectedLibraries}
              setSelectedLibraries={page.setLibraries}
              allowDuplicates={false}
            />
            <page.form.Field name="paired_end_libs">
              {(field) => (
                <FieldItem>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </page.form.Field>
          </ServiceCardContent>
        </Card>
      </div>
      <div className="md:col-span-6">
        <Card className="h-full">
          <ServiceCardHeader>
            <ServiceCardTitle>
              Selected Libraries
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger aria-label="Help: place read files using arrow buttons">
                    <HelpCircle className="service-card-tooltip-icon" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Place read files here using the arrow buttons</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </ServiceCardTitle>
            <CardDescription className="text-xs">
              Place read files here using the arrow buttons.
            </CardDescription>
          </ServiceCardHeader>
          <ServiceCardContent>
            <SelectedItemsTable
              items={page.selectedLibraries.map((library) => ({
                id: library.id,
                name: library.name,
                type: getLibraryTypeLabel(library.type),
              }))}
              onRemove={page.removeLibrary}
              className="max-h-80 overflow-y-auto"
            />
          </ServiceCardContent>
        </Card>
      </div>
    </>
  );
}

function PlatformSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: SarsCov2Platform) => void;
}) {
  return (
    <div className="space-y-2">
      <ServiceSubLabel>{label}</ServiceSubLabel>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next != null) onChange(next as SarsCov2Platform);
        }}
      >
        <ServiceSelectTrigger aria-label={label}>
          <SelectValue placeholder="Select a platform..." />
        </ServiceSelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
