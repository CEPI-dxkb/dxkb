"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ServiceHeader } from "@/components/services/service-header";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { genomeAlignmentMauveInfo } from "@/lib/services/info/genome-alignment";
import {
  defaultGenomeAlignmentFormValues,
  genomeAlignmentFormSchema,
  type GenomeAlignmentFormData,
} from "@/lib/forms/(genomics)/genome-alignment/genome-alignment-form-schema";
import { genomeAlignmentService } from "@/lib/forms/(genomics)/genome-alignment/genome-alignment-service";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { rerunBooleanValue } from "@/lib/rerun-utility";
import { fetchGenomesByIds, type GenomeSummary } from "@/lib/services/genome";
import { toast } from "sonner";
import {
  AlignmentParameters,
  GenomeSelection,
} from "./genome-alignment-sections";

function useGenomeAlignmentForm(
  submit: (value: GenomeAlignmentFormData) => Promise<void>,
) {
  return useForm({
    defaultValues: defaultGenomeAlignmentFormValues,
    validators: { onChange: genomeAlignmentFormSchema },
    onSubmit: async ({ value }) => submit(value),
  });
}
export type GenomeAlignmentForm = ReturnType<typeof useGenomeAlignmentForm>;

export default function GenomeAlignmentServicePage() {
  const [genomes, setGenomes] = useState<GenomeSummary[]>([]);
  const genomesRef = useRef(genomes);
  const selectionRevisionRef = useRef(0);
  const groupRequestRevisionRef = useRef(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const submitRef = useRef<(value: GenomeAlignmentFormData) => Promise<void>>(
    () => Promise.resolve(),
  );
  const form = useGenomeAlignmentForm((value) => submitRef.current(value));
  useEffect(() => {
    form.setFieldValue(
      "genome_ids",
      genomes.map((genome) => genome.genome_id),
    );
  }, [genomes, form]);
  const replaceGenomes = (nextGenomes: GenomeSummary[]) => {
    selectionRevisionRef.current += 1;
    genomesRef.current = nextGenomes;
    setGenomes(nextGenomes);
  };
  const runtime = useServiceRuntime({
    definition: genomeAlignmentService,
    form,
    rerun: {
      onApply: (data, targetForm) => {
        if (data.manual_seed_weight != null)
          targetForm.setFieldValue(
            "manual_seed_weight",
            rerunBooleanValue(data.manual_seed_weight),
          );
        if (data.seed_weight != null)
          targetForm.setFieldValue("seed_weight", data.seed_weight as never);
        if (data.weight != null)
          targetForm.setFieldValue("weight", data.weight as never);
        const ids = Array.isArray(data.genome_ids)
          ? (data.genome_ids as string[])
          : [];
        if (ids.length) {
          const selectionRevision = selectionRevisionRef.current;
          void fetchGenomesByIds(ids)
            .then((restoredGenomes) => {
              if (selectionRevision === selectionRevisionRef.current) {
                replaceGenomes(restoredGenomes);
              }
            })
            .catch(() => {
              if (selectionRevision === selectionRevisionRef.current) {
                toast.error("Could not restore genomes from previous job", {
                  description: "Please re-add your genomes manually.",
                });
              }
            });
        }
      },
    },
  });
  useEffect(() => {
    submitRef.current = async (value) => runtime.submitFormData(value);
  }, [runtime]);
  const reset = () => {
    groupRequestRevisionRef.current += 1;
    form.reset(defaultGenomeAlignmentFormValues);
    replaceGenomes([]);
    setShowAdvanced(false);
  };

  return (
    <section>
      <ServiceHeader
        title="Genome Alignment (Mauve)"
        description={
          <>
            The Genome Alignment service aligns genomes using{" "}
            <a
              href="https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0011147"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80"
            >
              progressiveMauve
            </a>
            .
          </>
        }
        infoPopupTitle={genomeAlignmentMauveInfo.title}
        infoPopupDescription={genomeAlignmentMauveInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />
      <form action={() => form.handleSubmit()} className="service-form-section">
        <GenomeSelection
          form={form}
          genomes={genomes}
          genomesRef={genomesRef}
          groupRequestRevisionRef={groupRequestRevisionRef}
          replaceGenomes={replaceGenomes}
        />
        <AlignmentParameters
          form={form}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          onOutputNameValidationChange={setIsOutputNameValid}
        />
        <div className="service-form-controls">
          <Button
            type="button"
            variant="outline"
            onClick={reset}
            disabled={runtime.isSubmitting}
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={
              runtime.isSubmitting || genomes.length < 2 || !isOutputNameValid
            }
          >
            {runtime.isSubmitting ? <Spinner className="mr-2 size-4" /> : null}
            Submit
          </Button>
        </div>
      </form>
      <JobParamsDialog {...runtime.jobParamsDialogProps} />
    </section>
  );
}
