"use client";

import type { MetagenomicReadMappingController } from "./use-metagenomic-read-mapping-controller";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { ReadLibraryInputSection } from "@/components/services/read-library-input-section";
import { SelectedLibrariesCard as SharedSelectedLibrariesCard } from "@/components/services/selected-libraries-card";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
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
import {
  FieldErrors,
  FieldItem,
  FieldLabel,
} from "@/components/ui/tanstack-form";
import {
  predefinedGeneSetOptions,
  type MetagenomicReadMappingFormData,
} from "@/lib/forms/(metagenomics)/metagenomic-read-mapping/metagenomic-read-mapping-form-schema";
import {
  metagenomicReadMappingParameters,
  readInputFileInfo,
} from "@/lib/services/info/metagenomic-read-mapping";
import type { WorkspaceObject } from "@/lib/services/workspace/types";

type Controller = MetagenomicReadMappingController;

export function ReadInputCard({ controller }: { controller: Controller }) {
  const {
    form,
    pairedRead1,
    pairedRead2,
    singleRead,
    sraResetKey,
    selectedLibraries,
    setPairedRead1,
    setPairedRead2,
    setSingleRead,
    setLibraries,
    handlePairedLibraryAdd,
    handleSingleLibraryAdd,
  } = controller;

  return (
    <div className="md:col-span-7">
      <Card className="h-full">
        <CardHeader className="service-card-header">
          <RequiredFormCardTitle className="service-card-title">
            Input File
            <DialogInfoPopup
              title={readInputFileInfo.title}
              description={readInputFileInfo.description}
              sections={readInputFileInfo.sections}
            />
          </RequiredFormCardTitle>
        </CardHeader>
        <CardContent className="service-card-content space-y-6">
          <ReadLibraryInputSection
            pairedRead1={pairedRead1}
            pairedRead2={pairedRead2}
            singleRead={singleRead}
            onPairedRead1Change={setPairedRead1}
            onPairedRead2Change={setPairedRead2}
            onSingleReadChange={setSingleRead}
            onAddPairedLibrary={handlePairedLibraryAdd}
            onAddSingleLibrary={handleSingleLibraryAdd}
          />
          <SraRunAccessionWithValidation
            key={sraResetKey}
            title="SRA Run Accession"
            placeholder="SRR..."
            selectedLibraries={selectedLibraries}
            setSelectedLibraries={setLibraries}
            allowDuplicates={false}
          />
          <form.Field name="paired_end_libs">
            {(field) => <FieldErrors field={field} />}
          </form.Field>
        </CardContent>
      </Card>
    </div>
  );
}

export function SelectedLibrariesCard({
  controller,
}: {
  controller: Controller;
}) {
  return (
    <div className="md:col-span-5">
      <SharedSelectedLibrariesCard
        items={controller.selectedLibraries}
        onRemove={controller.removeLibrary}
      />
    </div>
  );
}

export function ReadMappingParametersCard({
  controller,
}: {
  controller: Controller;
}) {
  const { form, geneSetType, outputPath, setIsOutputNameValid } = controller;

  return (
    <div className="md:col-span-12">
      <Card>
        <CardHeader className="service-card-header">
          <RequiredFormCardTitle className="service-card-title">
            Parameters
            <DialogInfoPopup
              title={metagenomicReadMappingParameters.title}
              description={metagenomicReadMappingParameters.description}
              sections={metagenomicReadMappingParameters.sections}
            />
          </RequiredFormCardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <form.Field name="gene_set_type">
              {(field) => (
                <FieldItem>
                  <FieldLabel field={field} className="service-card-label">
                    Gene Set Type
                  </FieldLabel>
                  <RadioGroup
                    value={field.state.value}
                    onValueChange={(value) => {
                      if (value != null)
                        field.handleChange(
                          value as MetagenomicReadMappingFormData["gene_set_type"],
                        );
                    }}
                    className="service-radio-group-horizontal"
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        value="predefined_list"
                        id="predefined_list"
                      />
                      <Label htmlFor="predefined_list" className="text-sm">
                        Predefined List
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="fasta_file" id="fasta_file" />
                      <Label htmlFor="fasta_file" className="text-sm">
                        FASTA File
                      </Label>
                    </div>
                    <div className="flex items-center gap-3">
                      <RadioGroupItem
                        value="feature_group"
                        id="feature_group"
                      />
                      <Label htmlFor="feature_group" className="text-sm">
                        Feature Group
                      </Label>
                    </div>
                  </RadioGroup>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
            {geneSetType === "predefined_list" && (
              <form.Field name="gene_set_name">
                {(field) => (
                  <FieldItem>
                    <FieldLabel field={field} className="service-card-label">
                      Predefined Gene Set Name
                    </FieldLabel>
                    <Select
                      items={predefinedGeneSetOptions}
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value != null) field.handleChange(value);
                      }}
                    >
                      <SelectTrigger
                        className="service-card-select-trigger"
                        aria-label="Predefined Gene Set Name"
                      >
                        <SelectValue placeholder="Select Gene Set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {predefinedGeneSetOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
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
            )}
            {geneSetType === "fasta_file" && (
              <form.Field name="gene_set_fasta">
                {(field) => (
                  <FieldItem>
                    <FieldLabel field={field} className="service-card-label">
                      Gene Set FASTA
                    </FieldLabel>
                    <WorkspaceObjectSelector
                      preset="geneSetFasta"
                      placeholder="Select Gene Set FASTA File..."
                      onSelectedObjectChange={(
                        object: WorkspaceObject | null,
                      ) => {
                        field.handleChange(object?.path || "");
                      }}
                      value={field.state.value}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            )}
            {geneSetType === "feature_group" && (
              <form.Field name="gene_set_feature_group">
                {(field) => (
                  <FieldItem>
                    <FieldLabel field={field} className="service-card-label">
                      Gene Set Feature Group
                    </FieldLabel>
                    <WorkspaceObjectSelector
                      preset="featureGroup"
                      placeholder="Select Gene Set Feature Group..."
                      onSelectedObjectChange={(
                        object: WorkspaceObject | null,
                      ) => {
                        field.handleChange(object?.path || "");
                      }}
                      value={field.state.value}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            )}
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
                      onValidationChange={setIsOutputNameValid}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
