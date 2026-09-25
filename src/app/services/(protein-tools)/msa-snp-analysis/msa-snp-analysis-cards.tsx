import type { ReactNode } from "react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { Card } from "@/components/ui/card";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import {
  msaSNPAnalysisParameters,
  msaSNPAnalysisSelectSequences,
} from "@/lib/services/info/msa-snp-analysis";

export function MsaSequenceSelectionCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Select sequences:
          <DialogInfoPopup
            title={msaSNPAnalysisSelectSequences.title}
            description={msaSNPAnalysisSelectSequences.description}
            sections={msaSNPAnalysisSelectSequences.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>{children}</ServiceCardContent>
    </Card>
  );
}

export function MsaReferenceSequenceCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Select a reference sequence:
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>{children}</ServiceCardContent>
    </Card>
  );
}

export function MsaParametersCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Parameters:
          <DialogInfoPopup
            title={msaSNPAnalysisParameters.title}
            description={msaSNPAnalysisParameters.description}
            sections={msaSNPAnalysisParameters.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>{children}</ServiceCardContent>
    </Card>
  );
}
