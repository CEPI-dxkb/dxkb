"use client";

import {
  ReadInputCard,
  ReadMappingParametersCard,
  SelectedLibrariesCard,
} from "./metagenomic-read-mapping-cards";
import { useMetagenomicReadMappingController } from "./use-metagenomic-read-mapping-controller";
import { ServiceHeader } from "@/components/services/service-header";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceFormFooter } from "@/components/services/form-ui/service-form-footer";
import { metagenomicReadMappingInfo } from "@/lib/services/info/metagenomic-read-mapping";

export default function MetagenomicReadMappingPage() {
  const controller = useMetagenomicReadMappingController();

  return (
    <section>
      <ServiceHeader
        title="Metagenomic Read Mapping"
        description="The Metagenomic Read Mapping Service uses KMA to align reads against
          antibiotic resistance genes from CARD and virulence factors from VFDB."
        infoPopupTitle={metagenomicReadMappingInfo.title}
        infoPopupDescription={metagenomicReadMappingInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/metagenomic_read_mapping_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/metagenomic_read_mapping/metagenomic_read_mapping.html"
        instructionalVideo="https://youtube.com/playlist?list=PLWfOyhOW_Oaurdhs675JawVb4LIcAncKc&si=TK4xGmL_92kiiHDG"
      />
      <form
        action={() => controller.form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <ReadInputCard controller={controller} />
        <SelectedLibrariesCard controller={controller} />
        <ReadMappingParametersCard controller={controller} />
        <div className="md:col-span-12">
          <ServiceFormFooter
            form={controller.form}
            onReset={controller.handleReset}
            isSubmitting={controller.isSubmitting}
            submitDisabled={!controller.canSubmit || !controller.isOutputNameValid}
            spinnerClassName="mr-2 size-4"
          />
        </div>
      </form>
      <JobParamsDialog {...controller.jobParamsDialogProps} />
    </section>
  );
}
