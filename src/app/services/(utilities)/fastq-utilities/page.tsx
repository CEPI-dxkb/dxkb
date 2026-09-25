"use client";

import { useFastqUtilitiesPage } from "./use-fastq-utilities-page";
import { FastqOutputCard, FastqPipelineCard } from "./fastq-parameters";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { ChevronRight } from "lucide-react";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { SelectedLibrariesCard } from "@/components/services/selected-libraries-card";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import {
  ServiceLabel,
  ServiceSubLabel,
} from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";

import {
  fastqUtilitiesInfo,
  readInputFileInfo,
} from "@/lib/services/info/fastq-utilities";

import { platformOptions } from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-form-schema";
import type { WorkspaceObject } from "@/lib/services/workspace/types";

export default function FastqUtilitiesPage() {
  const page = useFastqUtilitiesPage();
  const {
    form,
    pairedRead1,
    pairedRead2,
    singleRead,
    singlePlatform,
    sraResetKey,
    selectedLibraries,
    setPairedRead1,
    setPairedRead2,
    setSingleRead,
    setSinglePlatform,
    setLibraries,
    removeLibrary,
    handleReset,
    handlePairedLibraryAdd,
    handleSingleLibraryAdd,
    isSubmitting,
    jobParamsDialogProps,
    canSubmit,
  } = page;

  return (
    <section>
      <ServiceHeader
        title="FastQ Utilities"
        description="The FastQ Utilities Service provides capability for aligning, measuring base call quality, and trimming FastQ read files."
        infoPopupTitle={fastqUtilitiesInfo.title}
        infoPopupDescription={fastqUtilitiesInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/fastq_utilities_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/fastq_utilities/fastq_utilities.html"
        instructionalVideo="https://youtube.com/playlist?list=PLWfOyhOW_Oas1LLS2wRlWzilruoSxVeJw"
      />

      <form
        action={() => form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="md:col-span-7">
          <FastqOutputCard page={page} />
        </div>
        <div className="md:col-span-5">
          <FastqPipelineCard page={page} />
        </div>

        {/* Input Library Section */}
        <div className="md:col-span-7">
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
              {/* Paired Read Library */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <ServiceLabel>Paired Read Library</ServiceLabel>
                  <div className="mx-4 h-px flex-1 bg-border" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Add paired read library"
                    onClick={handlePairedLibraryAdd}
                    disabled={!pairedRead1 || !pairedRead2}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <div className="space-y-3">
                  <WorkspaceObjectSelector
                    preset="reads"
                    placeholder="Select READ FILE 1..."
                    value={pairedRead1 ?? ""}
                    onObjectSelect={(object: WorkspaceObject) => {
                      setPairedRead1(object.path);
                    }}
                  />
                  <WorkspaceObjectSelector
                    preset="reads"
                    placeholder="Select READ FILE 2..."
                    value={pairedRead2 ?? ""}
                    onObjectSelect={(object: WorkspaceObject) => {
                      setPairedRead2(object.path);
                    }}
                  />
                </div>
              </div>

              {/* Single Read Library */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <ServiceLabel>Single Read Library</ServiceLabel>
                  <div className="mx-4 h-px flex-1 bg-border" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Add single read library"
                    onClick={handleSingleLibraryAdd}
                    disabled={!singleRead || !singlePlatform}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
                <div>
                  <ServiceSubLabel>Platform</ServiceSubLabel>
                  <Select
                    items={platformOptions}
                    value={singlePlatform}
                    onValueChange={(value) => {
                      if (value != null) setSinglePlatform(value);
                    }}
                  >
                    <ServiceSelectTrigger aria-label="Select platform">
                      <SelectValue placeholder="Select a Platform..." />
                    </ServiceSelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {platformOptions.map((platform) => (
                          <SelectItem
                            key={platform.value}
                            value={platform.value}
                          >
                            {platform.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <WorkspaceObjectSelector
                  preset="reads"
                  placeholder="Select READ FILE..."
                  value={singleRead ?? ""}
                  onObjectSelect={(object: WorkspaceObject) => {
                    setSingleRead(object.path);
                  }}
                />
              </div>

              {/* SRA Run Accession */}
              <SraRunAccessionWithValidation
                key={sraResetKey}
                title="SRA Run Accession"
                placeholder="SRR..."
                selectedLibraries={selectedLibraries}
                setSelectedLibraries={setLibraries}
                allowDuplicates={false}
              />

              <form.Field name="paired_end_libs">
                {(field) => (
                  <FieldItem>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </ServiceCardContent>
          </Card>
        </div>

        {/* Selected Libraries Section */}
        <div className="md:col-span-5">
          <SelectedLibrariesCard
            items={selectedLibraries}
            onRemove={removeLibrary}
            tableClassName="max-h-80 overflow-y-auto"
          />
        </div>

        {/* Form Controls */}
        <div className="md:col-span-12">
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button type="submit" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? <Spinner className="mr-2 size-4" /> : null}
              Submit
            </Button>
          </div>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
