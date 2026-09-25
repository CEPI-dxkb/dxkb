"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { readInputFileInfo } from "@/lib/services/info/variation-analysis";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { VariationAnalysisController } from "./use-variation-analysis-form";

export function LibraryInputSection({
  controller,
}: {
  controller: VariationAnalysisController;
}) {
  const {
    pairedRead1,
    pairedRead2,
    singleRead,
    sraResetKey,
    selectedLibraries,
    setLibraries,
    setPairedRead1,
    setPairedRead2,
    setSingleRead,
    handlePairedLibraryAdd,
    handleSingleLibraryAdd,
  } = controller;
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Input File
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
              onObjectSelect={(object: WorkspaceObject) =>
                { setPairedRead1(object.path); }
              }
            />
            <WorkspaceObjectSelector
              preset="reads"
              placeholder="Select READ FILE 2..."
              onObjectSelect={(object: WorkspaceObject) =>
                { setPairedRead2(object.path); }
              }
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
              onClick={handleSingleLibraryAdd}
              disabled={!singleRead}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE..."
            onObjectSelect={(object: WorkspaceObject) =>
              { setSingleRead(object.path); }
            }
          />
        </div>
        <SraRunAccessionWithValidation
          key={sraResetKey}
          title="SRA Run Accession"
          placeholder="SRR..."
          selectedLibraries={selectedLibraries}
          setSelectedLibraries={setLibraries}
          allowDuplicates={false}
        />
      </ServiceCardContent>
    </Card>
  );
}
