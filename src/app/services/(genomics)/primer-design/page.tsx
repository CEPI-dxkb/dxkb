"use client";

import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { ServiceFormFooter } from "@/components/services/form-ui/service-form-footer";
import { primerDesignInfo } from "@/lib/services/info/primer-design";
import { PrimerAdvancedSection } from "./primer-advanced-section";
import { PrimerInputSection } from "./primer-input-section";
import { PrimerOptionsSection } from "./primer-options-section";
import { PrimerOutputSection } from "./primer-output-section";
import { usePrimerDesignForm } from "./use-primer-design-form";

export default function PrimerDesignServicePage() {
  const controller = usePrimerDesignForm();
  const { form, runtime, canSubmit, isOutputNameValid, handleReset } =
    controller;

  return (
    <section>
      <ServiceHeader
        title="Primer Design"
        description="The Primer Design Service utilizes Primer3 to design primers from a given input sequence under a variety of temperature, size, and concentration constraints."
        infoPopupTitle={primerDesignInfo.title}
        infoPopupDescription={primerDesignInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />
      <form action={() => form.handleSubmit()} className="service-form-section">
        <PrimerInputSection controller={controller}>
          <PrimerOptionsSection controller={controller} />
          <PrimerAdvancedSection controller={controller} />
        </PrimerInputSection>
        <PrimerOutputSection controller={controller} />
        <ServiceFormFooter
          form={form}
          onReset={handleReset}
          isSubmitting={runtime.isSubmitting}
          submitDisabled={!canSubmit || !isOutputNameValid}
          spinnerClassName="mr-2 size-4"
        />
      </form>
      <JobParamsDialog
        {...runtime.jobParamsDialogProps}
        serviceName="Primer Design"
      />
    </section>
  );
}
