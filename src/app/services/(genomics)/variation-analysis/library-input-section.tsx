"use client";

import { Card } from "@/components/ui/card";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import {
  ServiceLibraryAddButton,
  ServiceLibraryHeader,
} from "@/components/services/form-ui/service-library-header";
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
          <ServiceLibraryHeader title="Paired Read Library">
            <ServiceLibraryAddButton
              aria-label="Add paired read library"
              onClick={handlePairedLibraryAdd}
              disabled={!pairedRead1 || !pairedRead2}
            />
          </ServiceLibraryHeader>
          <div className="space-y-3">
            <WorkspaceObjectSelector
              preset="reads"
              placeholder="Select READ FILE 1..."
              value={pairedRead1 ?? ""}
              onObjectSelect={(object: WorkspaceObject) =>
                { setPairedRead1(object.path); }
              }
            />
            <WorkspaceObjectSelector
              preset="reads"
              placeholder="Select READ FILE 2..."
              value={pairedRead2 ?? ""}
              onObjectSelect={(object: WorkspaceObject) =>
                { setPairedRead2(object.path); }
              }
            />
          </div>
        </div>
        <div className="space-y-4">
          <ServiceLibraryHeader title="Single Read Library">
            <ServiceLibraryAddButton
              aria-label="Add single read library"
              onClick={handleSingleLibraryAdd}
              disabled={!singleRead}
            />
          </ServiceLibraryHeader>
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE..."
            value={singleRead ?? ""}
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
