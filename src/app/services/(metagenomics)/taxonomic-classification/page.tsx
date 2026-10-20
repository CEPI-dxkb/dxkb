"use client";

import {
  ClassificationInputCard,
  ClassificationSelectedLibrariesCard,
} from "./taxonomic-classification-input-cards";
import { ClassificationParametersCard } from "./taxonomic-classification-parameters-card";
import { useTaxonomicClassificationController } from "./use-taxonomic-classification-controller";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
import { taxonomyClassificationInfo } from "@/lib/services/info/taxonomic-classification";

export default function TaxonomicClassificationPage() {
  const controller = useTaxonomicClassificationController();
  return (
    <section>
      <ServiceHeader
        title="Taxonomic Classification"
        description="The Taxonomic Classification Service computes taxonomic classification for read data."
        infoPopupTitle={taxonomyClassificationInfo.title}
        infoPopupDescription={taxonomyClassificationInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/taxonomic_classification_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/taxonomic_classification/taxonomic_classification.html"
        instructionalVideo="https://youtu.be/PsqHeZ8pvt4"
      />
      <form
        action={() => controller.form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <ClassificationInputCard controller={controller} />
        <ClassificationSelectedLibrariesCard controller={controller} />
        <ClassificationParametersCard controller={controller} />
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
