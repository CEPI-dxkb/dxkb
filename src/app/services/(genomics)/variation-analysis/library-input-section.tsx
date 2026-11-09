"use client";

import { Card } from "@/components/ui/card";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { ReadLibraryInputSection } from "@/components/services/read-library-input-section";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { readInputFileInfo } from "@/lib/services/info/variation-analysis";
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
      </ServiceCardContent>
    </Card>
  );
}
