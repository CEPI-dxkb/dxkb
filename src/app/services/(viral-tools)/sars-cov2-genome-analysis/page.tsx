"use client";

import { useEffect, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { useServicePageState } from "../../use-service-page-state";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { ServiceHeader } from "@/components/services/service-header";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  sarsCov2GenomeAnalysisInfo,
  sarsCov2GenomeAnalysisStartWith,
} from "@/lib/services/info/sars-cov2-genome-analysis";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceRadioGroup } from "@/components/services/form-ui/service-radio-group";
import {
  defaultPrimerVersion,
  defaultSarsCov2GenomeAnalysisFormValues,
  primerVersionOptions,
  sarsCov2GenomeAnalysisFormSchema,
  type SarsCov2GenomeAnalysisFormData,
  type SarsCov2LibraryItem,
  type SarsCov2Platform,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";
import {
  computeOutputName,
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
  handleLibraryError,
  singleLibraryDuplicateMatcher,
} from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-utils";
import { sarsCov2GenomeAnalysisService } from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-service";
import {
  buildBaseLibraryItem,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";
import { toast } from "sonner";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import { SarsGenomeReadInputs } from "./sars-genome-sections";
import { SarsGenomeParameters } from "./sars-genome-parameters";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/sars_cov_2_assembly_annotation_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/sars_cov_2_assembly_annotation/sars_cov_2_assembly_annotation.html";

function useSarsGenomeForm(
  submit: (value: SarsCov2GenomeAnalysisFormData) => Promise<void>,
) {
  return useForm({
    defaultValues: defaultSarsCov2GenomeAnalysisFormValues,
    validators: { onChange: sarsCov2GenomeAnalysisFormSchema },
    onSubmit: async ({ value }) => submit(value),
  });
}
export type SarsGenomeForm = ReturnType<typeof useSarsGenomeForm>;

export default function SarsCov2GenomeAnalysisPage() {
  const submitRef = useRef<(value: SarsCov2GenomeAnalysisFormData) => Promise<void>>(
    () => Promise.resolve(),
  );
  const form = useSarsGenomeForm((value) => submitRef.current(value));
  const [state, setState] = useServicePageState<{
    pairedRead1: string | null;
    pairedRead2: string | null;
    pairedPlatform: SarsCov2Platform;
    singleRead: string | null;
    singlePlatform: SarsCov2Platform;
    sraResetKey: number;
    isOutputNameValid: boolean;
  }>({
    pairedRead1: null,
    pairedRead2: null,
    pairedPlatform: "illumina",
    singleRead: null,
    singlePlatform: "illumina",
    sraResetKey: 0,
    isOutputNameValid: true,
  });
  const inputType = useSelector(form.store, (value) => value.values.input_type);
  const recipe = useSelector(form.store, (value) => value.values.recipe);
  const primers = useSelector(form.store, (value) => value.values.primers);
  const scientificName = useSelector(
    form.store,
    (value) => value.values.scientific_name,
  );
  const myLabel = useSelector(form.store, (value) => value.values.my_label);
  const outputPath = useSelector(
    form.store,
    (value) => value.values.output_path,
  );
  const canSubmit = useSelector(form.store, (value) => value.canSubmit);
  const selection = useTanstackLibrarySelection<SarsCov2LibraryItem>({
    form,
    mapLibraryToItem: (library) => ({
      ...buildBaseLibraryItem(library),
      ...(library.platform && {
        platform: library.platform as SarsCov2Platform,
      }),
    }),
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });
  useEffect(() => {
    const output = computeOutputName(scientificName, myLabel);
    if (output) form.setFieldValue("output_file", output);
  }, [scientificName, myLabel, form]);
  useEffect(() => {
    if (recipe !== "onecodex") return;
    const version = defaultPrimerVersion[primers];
    if (version && form.state.values.primer_version !== version)
      form.setFieldValue("primer_version", version);
  }, [primers, recipe, form]);

  function reset() {
    form.reset(defaultSarsCov2GenomeAnalysisFormValues);
    selection.setLibraries([]);
    setState("pairedRead1")(null);
    setState("pairedRead2")(null);
    setState("singleRead")(null);
    setState("pairedPlatform")("illumina");
    setState("singlePlatform")("illumina");
    setState("sraResetKey")((key) => key + 1);
  }
  const runtime = useServiceRuntime({
    definition: sarsCov2GenomeAnalysisService,
    form,
    onSuccess: reset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (library, kind) =>
        kind === "paired" || kind === "single"
          ? { platform: library.platform || "illumina" }
          : {},
      syncLibraries: selection.setLibraries,
    },
  });
  useEffect(() => {
    submitRef.current = (value) => runtime.submitFormData(value);
  }, [runtime]);
  const page = {
    form,
    ...state,
    ...selection,
    setPairedRead1: setState("pairedRead1"),
    setPairedRead2: setState("pairedRead2"),
    setPairedPlatform: setState("pairedPlatform"),
    setSingleRead: setState("singleRead"),
    setSinglePlatform: setState("singlePlatform"),
    handlePairedLibraryAdd: () => {
      selection.addPairedLibrary({
        read1: state.pairedRead1,
        read2: state.pairedRead2,
        buildLibrary: getPairedLibraryBuildFn(state.pairedPlatform),
        onError: (message) => {
          handleLibraryError(message, toast);
        },
        onAfterAdd: () => {
          setState("pairedRead1")(null);
          setState("pairedRead2")(null);
        },
      });
    },
    handleSingleLibraryAdd: () => {
      selection.addSingleLibrary({
        read: state.singleRead,
        buildLibrary: getSingleLibraryBuildFn(state.singlePlatform),
        duplicateMatcher: singleLibraryDuplicateMatcher,
        onError: (message) => {
          handleLibraryError(message, toast);
        },
        onAfterAdd: () => {
          setState("singleRead")(null);
        },
      });
    },
  };

  return (
    <section>
      <ServiceHeader
        title="SARS-CoV-2 Genome Analysis"
        description="The SARS-CoV-2 Genome Analysis Service provides a streamlined meta-service that accepts raw reads and performs genome assembly, annotation, and variation analysis."
        infoPopupTitle={sarsCov2GenomeAnalysisInfo.title}
        infoPopupDescription={sarsCov2GenomeAnalysisInfo.description}
        quickReferenceGuide={quickReference}
        tutorial={tutorial}
      />
      <form
        action={() => form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="md:col-span-12">
          <Card>
            <ServiceCardHeader>
              <RequiredFormCardTitle>
                Start With
                <DialogInfoPopup
                  title={sarsCov2GenomeAnalysisStartWith.title}
                  description={sarsCov2GenomeAnalysisStartWith.description}
                  sections={sarsCov2GenomeAnalysisStartWith.sections}
                />
              </RequiredFormCardTitle>
            </ServiceCardHeader>
            <ServiceCardContent>
              <form.Field name="input_type">
                {(field) => (
                  <FieldItem>
                    <ServiceRadioGroup
                      value={field.state.value}
                      onValueChange={(value) => {
                        if (value != null)
                          field.handleChange(
                            value as SarsCov2GenomeAnalysisFormData["input_type"],
                          );
                      }}
                    >
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem value="reads" id="start-reads" />
                        <Label htmlFor="start-reads">Read File</Label>
                      </div>
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem value="contigs" id="start-contigs" />
                        <Label htmlFor="start-contigs">Assembled Contigs</Label>
                      </div>
                    </ServiceRadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </ServiceCardContent>
          </Card>
        </div>
        {inputType === "reads" && <SarsGenomeReadInputs page={page} />}
        {inputType === "contigs" && (
          <div className="md:col-span-12">
            <Card>
              <ServiceCardHeader>
                <RequiredFormCardTitle>
                  Input File
                </RequiredFormCardTitle>
              </ServiceCardHeader>
              <ServiceCardContent>
                <form.Field name="contigs">
                  {(field) => (
                    <FieldItem>
                      <ServiceLabel>Contigs</ServiceLabel>
                      <WorkspaceObjectSelector
                        preset="contigs"
                        placeholder="Select or Upload Contigs to your workspace for Annotation"
                        value={field.state.value ?? ""}
                        onObjectSelect={(object: WorkspaceObject) => {
                          field.handleChange(object.path);
                        }}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </ServiceCardContent>
            </Card>
          </div>
        )}
        <div className="col-span-full">
          <SarsGenomeParameters
            form={form}
            inputType={inputType}
            showPrimers={recipe === "onecodex"}
            primerVersions={primerVersionOptions[primers]}
            outputPath={outputPath}
            onValidationChange={setState("isOutputNameValid")}
          />
        </div>
        <div className="service-form-controls col-span-full">
          <Button type="button" variant="outline" onClick={reset}>
            Reset
          </Button>
          <Button
            type="submit"
            disabled={
              runtime.isSubmitting || !canSubmit || !state.isOutputNameValid
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
