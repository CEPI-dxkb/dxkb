"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ServiceHeader } from "@/components/services/service-header";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { genomeAnnotationInfo } from "@/lib/services/info/genome-annotation";
import {
  completeGenomeAnnotationSchema,
  defaultGenomeAnnotationFormValues,
  type GenomeAnnotationFormData,
} from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-schema";
import { validateMyLabel } from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-utils";
import { genomeAnnotationService } from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-service";
import { GenomeAnnotationParameters } from "./genome-annotation-parameters";

function useGenomeAnnotationForm(
  submit: (value: GenomeAnnotationFormData) => Promise<void>,
) {
  return useForm({
    defaultValues: defaultGenomeAnnotationFormValues,
    validators: { onChange: completeGenomeAnnotationSchema },
    onSubmit: async ({ value }) => submit(value),
  });
}

export type GenomeAnnotationForm = ReturnType<typeof useGenomeAnnotationForm>;

export default function GenomeAnnotationPage() {
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const submitRef = useRef<(value: GenomeAnnotationFormData) => Promise<void>>(
    () => Promise.resolve(),
  );
  const form = useGenomeAnnotationForm((value) => submitRef.current(value));
  const runtime = useServiceRuntime({
    definition: genomeAnnotationService,
    form,
  });
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  useEffect(() => {
    submitRef.current = async (value) => {
      const validation = validateMyLabel(value.my_label);
      if (!validation.isValid) {
        toast.error(validation.message);
        return;
      }
      await runtime.submitFormData(value);
    };
  }, [runtime]);

  return (
    <section>
      <ServiceHeader
        title="Genome Annotation"
        description="The Genome Annotation Service uses the RAST tool kit, RASTtk, for bacteria and the Viral Genome ORF Reader (VIGOR4) for viruses. The service accepts a FASTA formatted contig file and an annotation recipe based on taxonomy to provide an annotated genome, to provide annotation of genomic features."
        infoPopupTitle={genomeAnnotationInfo.title}
        infoPopupDescription={genomeAnnotationInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />
      <form action={() => form.handleSubmit()} className="service-form-section">
        <GenomeAnnotationParameters
          form={form}
          onOutputNameValidationChange={setIsOutputNameValid}
        />
        <div className="service-form-controls">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                form.reset(defaultGenomeAnnotationFormValues);
              }}
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
              Annotate
            </Button>
          </div>
        </div>
      </form>
      <JobParamsDialog {...runtime.jobParamsDialogProps} />
    </section>
  );
}
