"use client";

import {
  ReadInputCard,
  ReadMappingParametersCard,
  SelectedLibrariesCard,
} from "./metagenomic-read-mapping-cards";
import { useMetagenomicReadMappingController } from "./use-metagenomic-read-mapping-controller";
import { ServiceHeader } from "@/components/services/service-header";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
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
          <ServiceSubmitError form={controller.form} />
          <div className="service-form-controls">
            <Button
              type="button"
              variant="outline"
              onClick={controller.handleReset}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                controller.isSubmitting ||
                !controller.canSubmit ||
                !controller.isOutputNameValid
              }
            >
              {controller.isSubmitting ? (
                <Spinner className="mr-2 size-4" />
              ) : null}
              Submit
            </Button>
          </div>
        </div>
      </form>
      <JobParamsDialog {...controller.jobParamsDialogProps} />
    </section>
  );
}
