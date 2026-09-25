"use client";

import type { MetagenomicBinningController } from "./use-metagenomic-binning-controller";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ReadLibraryInputSection } from "@/components/services/read-library-input-section";
import { SelectedLibrariesCard } from "@/components/services/selected-libraries-card";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import { ServiceFieldLabel } from "@/components/services/form-ui/service-field";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import type { MetagenomicBinningFormData } from "@/lib/forms/(metagenomics)/metagenomic-binning/metagenomic-binning-form-schema";
import {
  metagenomicBinningInputFile,
  metagenomicBinningStartWith,
} from "@/lib/services/info/metagenomic-binning";
import type { WorkspaceObject } from "@/lib/services/workspace/types";

type Controller = MetagenomicBinningController;

export function BinningStartWithCard({
  controller,
}: {
  controller: Controller;
}) {
  return (
    <div className="md:col-span-12">
      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>
            Start With
            <DialogInfoPopup
              title={metagenomicBinningStartWith.title}
              description={metagenomicBinningStartWith.description}
              sections={metagenomicBinningStartWith.sections}
            />
          </ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <controller.form.Field name="start_with">
            {(field) => (
              <FieldItem>
                <ServiceRadioGroup
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value != null)
                      field.handleChange(
                        value as MetagenomicBinningFormData["start_with"],
                      );
                  }}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="reads" id="reads" />
                    <Label htmlFor="reads">Read Files</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="contigs" id="contigs" />
                    <Label htmlFor="contigs">Assembled Contigs</Label>
                  </div>
                </ServiceRadioGroup>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </controller.form.Field>
        </ServiceCardContent>
      </Card>
    </div>
  );
}

export function BinningReadInputCards({
  controller,
}: {
  controller: Controller;
}) {
  const { state, setState, selectedLibraries } = controller;
  return (
    <>
      <div className="md:col-span-7">
        <Card className="h-full">
          <ServiceCardHeader>
            <RequiredFormCardTitle>
              Input File
              <DialogInfoPopup
                title={metagenomicBinningInputFile.title}
                description={metagenomicBinningInputFile.description}
                sections={metagenomicBinningInputFile.sections}
              />
            </RequiredFormCardTitle>
          </ServiceCardHeader>
          <ServiceCardContent className="space-y-6">
            <ReadLibraryInputSection
              pairedRead1={state.pairedRead1}
              pairedRead2={state.pairedRead2}
              singleRead={state.singleRead}
              onPairedRead1Change={setState("pairedRead1")}
              onPairedRead2Change={setState("pairedRead2")}
              onSingleReadChange={setState("singleRead")}
              onAddPairedLibrary={controller.handlePairedLibraryAdd}
              onAddSingleLibrary={controller.handleSingleLibraryAdd}
            />
            <SraRunAccessionWithValidation
              key={state.sraResetKey}
              title="SRA Run Accession"
              placeholder="SRR..."
              selectedLibraries={selectedLibraries}
              setSelectedLibraries={controller.setLibraries}
              allowDuplicates={false}
            />
            <controller.form.Field name="paired_end_libs">
              {(field) => <FieldErrors field={field} />}
            </controller.form.Field>
          </ServiceCardContent>
        </Card>
      </div>
      <div className="md:col-span-5">
        <SelectedLibrariesCard
          items={selectedLibraries}
          onRemove={controller.removeLibrary}
        />
      </div>
    </>
  );
}

export function BinningContigsCard({ controller }: { controller: Controller }) {
  return (
    <div className="md:col-span-12">
      <Card>
        <ServiceCardHeader>
          <RequiredFormCardTitle>
            Input File
            <DialogInfoPopup
              title={metagenomicBinningInputFile.title}
              description={metagenomicBinningInputFile.description}
              sections={metagenomicBinningInputFile.sections}
            />
          </RequiredFormCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent className="space-y-6">
          <controller.form.Field name="contigs">
            {(field) => (
              <FieldItem>
                <ServiceFieldLabel field={field}>Contigs</ServiceFieldLabel>
                <WorkspaceObjectSelector
                  id={field.name}
                  preset="contigs"
                  placeholder="Select or Upload Contigs..."
                  onSelectedObjectChange={(object: WorkspaceObject | null) => {
                    field.handleChange(object?.path || "");
                  }}
                  value={field.state.value}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </controller.form.Field>
        </ServiceCardContent>
      </Card>
    </div>
  );
}
