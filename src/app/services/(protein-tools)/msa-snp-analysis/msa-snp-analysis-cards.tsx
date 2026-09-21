import type { ReactNode } from "react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  msaSNPAnalysisParameters,
  msaSNPAnalysisSelectSequences,
} from "@/lib/services/info/msa-snp-analysis";

export function MsaSequenceSelectionCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="service-card-header">
        <RequiredFormCardTitle className="service-card-title">
          Select sequences:
          <DialogInfoPopup
            title={msaSNPAnalysisSelectSequences.title}
            description={msaSNPAnalysisSelectSequences.description}
            sections={msaSNPAnalysisSelectSequences.sections}
          />
        </RequiredFormCardTitle>
      </CardHeader>
      <CardContent className="service-card-content">{children}</CardContent>
    </Card>
  );
}

export function MsaReferenceSequenceCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="service-card-header">
        <RequiredFormCardTitle className="service-card-title">
          Select a reference sequence:
        </RequiredFormCardTitle>
      </CardHeader>
      <CardContent className="service-card-content">{children}</CardContent>
    </Card>
  );
}

export function MsaParametersCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="service-card-header">
        <RequiredFormCardTitle className="service-card-title">
          Parameters:
          <DialogInfoPopup
            title={msaSNPAnalysisParameters.title}
            description={msaSNPAnalysisParameters.description}
            sections={msaSNPAnalysisParameters.sections}
          />
        </RequiredFormCardTitle>
      </CardHeader>
      <CardContent className="service-card-content">{children}</CardContent>
    </Card>
  );
}
