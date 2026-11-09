import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { SelectedLibrariesCard } from "@/components/services/selected-libraries-card";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceSubLabel } from "@/components/services/form-ui/service-label";
import {
  ServiceLibraryAddButton,
  ServiceLibraryHeader,
} from "@/components/services/form-ui/service-library-header";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import { readInputFileInfo } from "@/lib/services/info/sars-cov2-genome-analysis";
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
              <ServiceLibraryHeader title="Paired Read Library">
                <ServiceLibraryAddButton
                  aria-label="Add paired read library"
                  onClick={page.handlePairedLibraryAdd}
                  disabled={!page.pairedRead1 || !page.pairedRead2}
                />
              </ServiceLibraryHeader>
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
                <ServiceLibraryHeader title="Single Read Library">
                  <ServiceLibraryAddButton
                    aria-label="Add single read library"
                    onClick={page.handleSingleLibraryAdd}
                    disabled={!page.singleRead}
                  />
                </ServiceLibraryHeader>
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
        <SelectedLibrariesCard
          items={page.selectedLibraries}
          onRemove={page.removeLibrary}
          tableClassName="max-h-80 overflow-y-auto"
        />
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
