"use client";

import { ChevronRight } from "lucide-react";
import type { TaxonomicClassificationController } from "./use-taxonomic-classification-controller";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { SelectedLibrariesCard } from "@/components/services/selected-libraries-card";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldErrors } from "@/components/ui/tanstack-form";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import {
  ServiceLabel,
  ServiceSubLabel,
} from "@/components/services/form-ui/service-label";
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
            <div className="flex items-center justify-between">
              <ServiceLabel>Paired Read Library</ServiceLabel>
              <div className="mx-4 h-px flex-1 bg-border" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Add paired read library"
                onClick={controller.handlePairedLibraryAdd}
                disabled={!state.pairedRead1 || !state.pairedRead2}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
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
            <div>
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
                className="mt-1.5 font-mono text-sm"
              />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <ServiceLabel>Single Read Library</ServiceLabel>
              <div className="mx-4 h-px flex-1 bg-border" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Add single read library"
                onClick={controller.handleSingleLibraryAdd}
                disabled={!state.singleRead}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
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
            <div>
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
                className="mt-1.5 font-mono text-sm"
              />
            </div>
          </div>
          <SraRunAccessionWithValidation
            key={state.sraResetKey}
            title="SRA Run Accession"
            placeholder="SRR..."
            selectedLibraries={selectedLibraries}
            setSelectedLibraries={controller.handleSetSelectedLibraries}
            allowDuplicates={false}
          />
          <div>
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
              className="mt-1.5 font-mono text-sm"
            />
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
