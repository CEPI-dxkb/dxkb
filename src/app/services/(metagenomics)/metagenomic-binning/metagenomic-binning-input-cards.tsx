"use client";

import type { MetagenomicBinningController } from "./use-metagenomic-binning-controller";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ReadLibraryInputSection } from "@/components/services/read-library-input-section";
import { SelectedLibrariesCard } from "@/components/services/selected-libraries-card";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FieldErrors,
  FieldItem,
  FieldLabel,
} from "@/components/ui/tanstack-form";
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
        <CardHeader className="service-card-header">
          <CardTitle className="service-card-title">
            Start With
            <DialogInfoPopup
              title={metagenomicBinningStartWith.title}
              description={metagenomicBinningStartWith.description}
              sections={metagenomicBinningStartWith.sections}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="service-card-content">
          <controller.form.Field name="start_with">
            {(field) => (
              <FieldItem>
                <RadioGroup
                  value={field.state.value}
                  onValueChange={(value) => {
                    if (value != null)
                      field.handleChange(
                        value as MetagenomicBinningFormData["start_with"],
                      );
                  }}
                  className="service-radio-group-horizontal"
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="reads" id="reads" />
                    <Label htmlFor="reads">Read Files</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="contigs" id="contigs" />
                    <Label htmlFor="contigs">Assembled Contigs</Label>
                  </div>
                </RadioGroup>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </controller.form.Field>
        </CardContent>
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
          <CardHeader className="service-card-header">
            <RequiredFormCardTitle className="service-card-title">
              Input File
              <DialogInfoPopup
                title={metagenomicBinningInputFile.title}
                description={metagenomicBinningInputFile.description}
                sections={metagenomicBinningInputFile.sections}
              />
            </RequiredFormCardTitle>
          </CardHeader>
          <CardContent className="service-card-content space-y-6">
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
          </CardContent>
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
        <CardHeader className="service-card-header">
          <RequiredFormCardTitle className="service-card-title">
            Input File
            <DialogInfoPopup
              title={metagenomicBinningInputFile.title}
              description={metagenomicBinningInputFile.description}
              sections={metagenomicBinningInputFile.sections}
            />
          </RequiredFormCardTitle>
        </CardHeader>
        <CardContent className="service-card-content space-y-6">
          <controller.form.Field name="contigs">
            {(field) => (
              <FieldItem>
                <FieldLabel field={field} className="service-card-label">
                  Contigs
                </FieldLabel>
                <WorkspaceObjectSelector
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
        </CardContent>
      </Card>
    </div>
  );
}
