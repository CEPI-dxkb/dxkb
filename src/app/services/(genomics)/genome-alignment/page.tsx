"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ServiceHeader } from "@/components/services/service-header";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
import { genomeAlignmentMauveInfo } from "@/lib/services/info/genome-alignment";
import {
  defaultGenomeAlignmentFormValues,
  genomeAlignmentFormSchema,
  type GenomeAlignmentFormData,
} from "@/lib/forms/(genomics)/genome-alignment/genome-alignment-form-schema";
import { genomeAlignmentService } from "@/lib/forms/(genomics)/genome-alignment/genome-alignment-service";
import {
  idOnlyGenome,
  type UnverifiedGenomes,
} from "@/lib/forms/(genomics)/genome-alignment/genome-alignment-form-utils";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { rerunBooleanValue } from "@/lib/rerun-utility";
import { fetchGenomesByIds, type GenomeSummary } from "@/lib/services/genome";
import { formatUserFacingErrorMessage } from "@/lib/utils";
import {
  AlignmentParameters,
  GenomeSelection,
} from "./genome-alignment-sections";

// The empty selection, as one array that is never mutated: the initial state
// and what Reset restores. The effect below compares against it by identity.
const noGenomes: GenomeSummary[] = [];

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
  const [genomes, setGenomes] = useState<GenomeSummary[]>(noGenomes);
  const genomesRef = useRef(genomes);
  const selectionRevisionRef = useRef(0);
  const groupRequestRevisionRef = useRef(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Remounts GenomeSelection on reset: its selectors keep their search text
  // internally, and its group fetch state must not outlive the reset.
  const [selectionResetKey, setSelectionResetKey] = useState(0);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [unverified, setUnverified] = useState<UnverifiedGenomes | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const submitRef = useRef<(value: GenomeAlignmentFormData) => Promise<void>>(
    () => Promise.resolve(),
  );
  const form = useGenomeAlignmentForm((value) => submitRef.current(value));
  useEffect(() => {
    // Syncing the empty selection (on mount, and after Reset) only copies it
    // into the field. It must not mark the field touched or validate it, or
    // "Select at least two genomes" shows before the user has done anything
    // (or right after Reset, which has just cleared it). `dontUpdateMeta`
    // alone is not enough: `setFieldValue` still validates a mounted field,
    // and that marks it touched. Comparing against the shared empty array,
    // rather than flipping a flag on the first run, keeps this true when
    // Strict Mode runs the effect twice on mount. Removing the last genome
    // builds a new empty array, so that path still validates.
    const untouched =
      genomes === noGenomes
        ? { dontUpdateMeta: true, dontValidate: true }
        : undefined;
    form.setFieldValue(
      "genome_ids",
      genomes.map((genome) => genome.genome_id),
      untouched,
    );
  }, [genomes, form]);
  const replaceGenomes = (nextGenomes: GenomeSummary[]) => {
    selectionRevisionRef.current += 1;
    genomesRef.current = nextGenomes;
    setGenomes(nextGenomes);
  };
  // Restores a previous job's genomes. Their IDs are the job's, so they are
  // kept even when the lookup that names them fails (as ID-only rows, which
  // still submit); what could not be confirmed is shown with a Retry.
  const restoreGenomes = (ids: string[]) => {
    const selectionRevision = selectionRevisionRef.current;
    // A Retry runs over the current list, so keep any entry it already has.
    const current = (id: string) =>
      genomesRef.current.find((genome) => genome.genome_id === id) ??
      idOnlyGenome(id);
    setIsVerifying(true);
    void fetchGenomesByIds(ids)
      .then(
        (found) => {
          if (selectionRevision !== selectionRevisionRef.current) return;
          const byId = new Map(found.map((genome) => [genome.genome_id, genome]));
          replaceGenomes(ids.map((id) => byId.get(id) ?? current(id)));
          const missing = ids.filter((id) => !byId.has(id));
          setUnverified(missing.length ? { ids: missing, error: null } : null);
        },
        (error: unknown) => {
          if (selectionRevision !== selectionRevisionRef.current) return;
          replaceGenomes(ids.map(current));
          setUnverified({
            ids,
            error: formatUserFacingErrorMessage(error, "Genome lookup failed"),
          });
        },
      )
      .finally(() => {
        setIsVerifying(false);
      });
  };
  // Only the unverified genomes still in the list are worth a note.
  const unverifiedIds = unverified
    ? genomes
        .filter(
          (genome) =>
            unverified.ids.includes(genome.genome_id) &&
            genome.genome_name === genome.genome_id,
        )
        .map((genome) => genome.genome_id)
    : [];
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
          ? (data.genome_ids as unknown[]).map(String)
          : [];
        if (ids.length) restoreGenomes(ids);
      },
    },
  });
  useEffect(() => {
    submitRef.current = async (value) => runtime.submitFormData(value);
  }, [runtime]);
  const reset = () => {
    groupRequestRevisionRef.current += 1;
    form.reset(defaultGenomeAlignmentFormValues);
    replaceGenomes(noGenomes);
    setUnverified(null);
    setShowAdvanced(false);
    setSelectionResetKey((key) => key + 1);
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
          key={selectionResetKey}
          form={form}
          genomes={genomes}
          genomesRef={genomesRef}
          groupRequestRevisionRef={groupRequestRevisionRef}
          replaceGenomes={replaceGenomes}
        />
        {unverified && unverifiedIds.length > 0 ? (
          <Alert variant={unverified.error ? "destructive" : "default"}>
            <CircleAlert aria-hidden="true" />
            <AlertTitle>
              {unverified.error
                ? "Genome names could not be loaded"
                : "Some genomes from the previous job were not found"}
            </AlertTitle>
            <AlertDescription>
              {unverified.error ? <p>{unverified.error}</p> : null}
              <p>
                Listed by ID only: {unverifiedIds.join(", ")}.{" "}
                {unverified.error
                  ? "You can still submit them."
                  : "Remove any that no longer exist before you submit."}
              </p>
              {unverified.error ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isVerifying}
                  onClick={() => {
                    restoreGenomes(genomesRef.current.map((genome) => genome.genome_id));
                  }}
                >
                  {isVerifying ? <Spinner /> : null}
                  Retry
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <AlignmentParameters
          form={form}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          onOutputNameValidationChange={setIsOutputNameValid}
        />
        <ServiceSubmitError form={form} />
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
