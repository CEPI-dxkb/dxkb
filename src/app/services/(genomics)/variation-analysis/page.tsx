"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { variationAnalysisInfo } from "@/lib/services/info/variation-analysis";
import { LibraryInputSection } from "./library-input-section";
import { ParametersSection } from "./parameters-section";
import { SelectedLibrariesSection } from "./selected-libraries-section";
import { useVariationAnalysisForm } from "./use-variation-analysis-form";

export default function VariationAnalysisPage() {
  const controller = useVariationAnalysisForm();
  const { form, runtime, canSubmit, isOutputNameValid, handleReset } =
    controller;
  return (
    <section>
      <ServiceHeader
        title="Variation Analysis"
        description="The Variation Analysis Service can be used to identify and annotate sequence variations."
        infoPopupTitle={variationAnalysisInfo.title}
        infoPopupDescription={variationAnalysisInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/variation_analysis_service.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/variation_analysis/variation_analysis.html"
      />
      <form
        action={() => form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="space-y-6 md:col-span-7">
          <LibraryInputSection controller={controller} />
          <SelectedLibrariesSection
            controller={controller}
            className="md:hidden"
          />
          <ParametersSection controller={controller} />
        </div>
        <SelectedLibrariesSection
          controller={controller}
          className="hidden md:col-span-5 md:block"
        />
        <div className="service-form-controls md:col-span-12">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                runtime.isSubmitting || !canSubmit || !isOutputNameValid
              }
            >
              {runtime.isSubmitting ? <Spinner /> : null}
              Submit
            </Button>
          </div>
        </div>
      </form>
      <JobParamsDialog {...runtime.jobParamsDialogProps} />
    </section>
  );
}
