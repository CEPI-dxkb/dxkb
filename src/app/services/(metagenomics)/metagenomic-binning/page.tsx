"use client";

import {
  BinningContigsCard,
  BinningReadInputCards,
  BinningStartWithCard,
} from "./metagenomic-binning-input-cards";
import { BinningParametersCard } from "./metagenomic-binning-parameters-card";
import { useMetagenomicBinningController } from "./use-metagenomic-binning-controller";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
import { metagenomicBinningInfo } from "@/lib/services/info/metagenomic-binning";

export default function MetagenomicBinningPage() {
  const controller = useMetagenomicBinningController();
  return (
    <section>
      <ServiceHeader
        title="Metagenomic Binning"
        description="The Metagenomic Binning Service accepts either reads or contigs, and
          attempts to 'bin' the data into a set of genomes. This service can be
          used to reconstruct bacterial and archaeal genomes from environmental
          samples."
        infoPopupTitle={metagenomicBinningInfo.title}
        infoPopupDescription={metagenomicBinningInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/metagenomic_binning_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/metagenomic_binning/metagenomic_binning.html"
        instructionalVideo="https://youtube.com/playlist?list=PLWfOyhOW_OasTc7mmLSXZvQYrO_R5se47&si=X66tQsvWsW0GuA6Z"
      />
      <form
        action={() => controller.form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <BinningStartWithCard controller={controller} />
        {controller.startWith === "reads" ? (
          <BinningReadInputCards controller={controller} />
        ) : (
          <BinningContigsCard controller={controller} />
        )}
        <BinningParametersCard controller={controller} />
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
                !controller.state.isOutputNameValid
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
