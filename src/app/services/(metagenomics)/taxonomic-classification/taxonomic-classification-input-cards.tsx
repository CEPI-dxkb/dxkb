"use client";

import type { TaxonomicClassificationController } from "./use-taxonomic-classification-controller";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { SelectedLibrariesCard } from "@/components/services/selected-libraries-card";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceSubLabel } from "@/components/services/form-ui/service-label";
import {
  ServiceLibraryAddButton,
  ServiceLibraryHeader,
} from "@/components/services/form-ui/service-library-header";
import { extractSampleIdFromPath } from "@/lib/forms/service-library-rules";
import { taxonomyClassificationInput } from "@/lib/services/info/taxonomic-classification";
import type { WorkspaceObject } from "@/lib/services/workspace/types";

type Controller = TaxonomicClassificationController;

export function ClassificationInputCard({
  controller,
}: {
  controller: Controller;
}) {
  const { form, state, setState, selectedLibraries } = controller;
  return (
    <div className="md:col-span-7">
      <Card className="h-full">
        <ServiceCardHeader>
          <RequiredFormCardTitle>
            Input File
            <DialogInfoPopup
              title={taxonomyClassificationInput.title}
              description={taxonomyClassificationInput.description}
            />
          </RequiredFormCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent className="space-y-6">
          <div className="space-y-4">
            <ServiceLibraryHeader title="Paired Read Library">
              <ServiceLibraryAddButton
                aria-label="Add paired read library"
                onClick={controller.handlePairedLibraryAdd}
                disabled={!state.pairedRead1 || !state.pairedRead2}
              />
            </ServiceLibraryHeader>
            <div className="space-y-3">
              <WorkspaceObjectSelector
                preset="reads"
                placeholder="Select READ FILE 1..."
                value={state.pairedRead1 ?? ""}
                onObjectSelect={(object: WorkspaceObject) => {
                  setState("pairedRead1")(object.path);
                  setState("pairedSampleId")(
                    extractSampleIdFromPath(object.path),
                  );
                }}
              />
              <WorkspaceObjectSelector
                preset="reads"
                placeholder="Select READ FILE 2..."
                value={state.pairedRead2 ?? ""}
                onObjectSelect={(object: WorkspaceObject) => {
                  setState("pairedRead2")(object.path);
                  if (!state.pairedRead1)
                    setState("pairedSampleId")(
                      extractSampleIdFromPath(object.path),
                    );
                }}
              />
            </div>
            {/* A FieldItem, not a bare div: a sub-label that is a direct child
                of a field container loses its own `mb-2` (globals.css), so
                the grid's `gap-2` is the whole 8px to the input. A bare div
                kept the margin and the input's `mt-1.5` on top: 14px. */}
            <FieldItem>
              <ServiceSubLabel htmlFor="paired-sample-id">
                Sample Identifier
              </ServiceSubLabel>
              <ServiceInput
                id="paired-sample-id"
                value={state.pairedSampleId}
                onChange={(event) => {
                  controller.handleSampleIdChange("paired", event.target.value);
                }}
                placeholder="Sample ID"
                variant="mono"
              />
            </FieldItem>
          </div>
          <div className="space-y-4">
            <ServiceLibraryHeader title="Single Read Library">
              <ServiceLibraryAddButton
                aria-label="Add single read library"
                onClick={controller.handleSingleLibraryAdd}
                disabled={!state.singleRead}
              />
            </ServiceLibraryHeader>
            <WorkspaceObjectSelector
              preset="reads"
              placeholder="Select READ FILE..."
              value={state.singleRead ?? ""}
              onObjectSelect={(object: WorkspaceObject) => {
                setState("singleRead")(object.path);
                setState("singleSampleId")(
                  extractSampleIdFromPath(object.path),
                );
              }}
            />
            <FieldItem>
              <ServiceSubLabel htmlFor="single-sample-id">
                Sample Identifier
              </ServiceSubLabel>
              <ServiceInput
                id="single-sample-id"
                value={state.singleSampleId}
                onChange={(event) => {
                  controller.handleSampleIdChange("single", event.target.value);
                }}
                placeholder="Sample ID"
                variant="mono"
              />
            </FieldItem>
          </div>
          {/* Grouped like the two libraries above (`space-y-4`, not the
              card's `space-y-6`), so the sample identifier sits with the
              accession it names. */}
          <div className="space-y-4">
            <SraRunAccessionWithValidation
              key={state.sraResetKey}
              title="SRA Run Accession"
              placeholder="SRR..."
              selectedLibraries={selectedLibraries}
              setSelectedLibraries={controller.handleSetSelectedLibraries}
              allowDuplicates={false}
            />
            <FieldItem>
              <ServiceSubLabel htmlFor="srr-sample-id">
                Sample Identifier
              </ServiceSubLabel>
              <ServiceInput
                id="srr-sample-id"
                value={state.srrSampleId}
                onChange={(event) => {
                  controller.handleSampleIdChange("srr", event.target.value);
                }}
                placeholder="Sample ID"
                variant="mono"
              />
            </FieldItem>
          </div>
          <form.Field name="paired_end_libs">
            {(field) => <FieldErrors field={field} />}
          </form.Field>
        </ServiceCardContent>
      </Card>
    </div>
  );
}

export function ClassificationSelectedLibrariesCard({
  controller,
}: {
  controller: Controller;
}) {
  return (
    <div className="md:col-span-5">
      <SelectedLibrariesCard
        items={controller.selectedLibraries}
        onRemove={controller.removeLibrary}
      />
    </div>
  );
}
