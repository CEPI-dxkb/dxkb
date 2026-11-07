"use client";

import {
  ClassificationInputCard,
  ClassificationSelectedLibrariesCard,
} from "./taxonomic-classification-input-cards";
import { ClassificationParametersCard } from "./taxonomic-classification-parameters-card";
import { useTaxonomicClassificationController } from "./use-taxonomic-classification-controller";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { ServiceFormFooter } from "@/components/services/form-ui/service-form-footer";
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
          <ServiceFormFooter
            form={controller.form}
            onReset={controller.handleReset}
            isSubmitting={controller.isSubmitting}
            submitDisabled={!controller.canSubmit || !controller.state.isOutputNameValid}
            spinnerClassName="mr-2 size-4"
          />
        </div>
      </form>
      <JobParamsDialog {...controller.jobParamsDialogProps} />
    </section>
  );
}
