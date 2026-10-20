"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useServicePageState } from "../../use-service-page-state";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { ServiceHeader } from "@/components/services/service-header";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";
import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";

import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { sarsCov2WastewaterAnalysisInfo } from "@/lib/services/info/sars-cov2-wastewater-analysis";

import {
  sarsCov2WastewaterAnalysisFormSchema,
  defaultSarsCov2WastewaterAnalysisFormValues,
  primerVersionOptions,
  defaultPrimerVersion,
  type SarsCov2WastewaterAnalysisFormData,
  type SarsCov2WastewaterLibraryItem,
  type SrrLibItem,
} from "@/lib/forms/(viral-tools)/sars-cov2-wastewater-analysis/sars-cov2-wastewater-analysis-form-schema";
import {
  handleLibraryError as handleLibraryErrorUtil,
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
  singleLibraryDuplicateMatcher,
  findNewSraLibraries,
  resolveSampleIdAndDate,
  getDefaultSampleIdFromPath,
  getDefaultSampleIdFromSrr,
} from "@/lib/forms/(viral-tools)/sars-cov2-wastewater-analysis/sars-cov2-wastewater-analysis-form-utils";
import { sarsCov2WastewaterAnalysisService } from "@/lib/forms/(viral-tools)/sars-cov2-wastewater-analysis/sars-cov2-wastewater-analysis-service";
import {
  buildBaseLibraryItem,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";
import type { Library } from "@/types/services";
import { WastewaterParameters } from "./wastewater-parameters";
import { WastewaterLibrary } from "./wastewater-library";
import { WastewaterSelectedLibraries } from "./wastewater-selected-libraries";

const quickReference =
  "https://www.bv-brc.org/docs/quick_references/services/sars_cov_2_wastewater_analysis_service.html";
const tutorial =
  "https://www.bv-brc.org/docs/tutorial/sars_cov_2_wastewater/sars_cov_2_wastewater.html";

function useWastewaterForm(
  submit: (value: SarsCov2WastewaterAnalysisFormData) => Promise<void>,
) {
  return useForm({
    defaultValues: defaultSarsCov2WastewaterAnalysisFormValues,
    validators: { onChange: sarsCov2WastewaterAnalysisFormSchema },
    onSubmit: async ({ value }) => submit(value),
  });
}
export type WastewaterForm = ReturnType<typeof useWastewaterForm>;

export default function SarsCov2WastewaterAnalysisPage() {
  const submitRef = useRef<
    (value: SarsCov2WastewaterAnalysisFormData) => Promise<void>
  >(() => Promise.resolve());
  const form = useWastewaterForm((value) => submitRef.current(value));

  const outputPath = useSelector(form.store, (s) => s.values.output_path);
  const canSubmit = useSelector(form.store, (s) => s.canSubmit);

  const [pageState, setPageState] = useServicePageState({
    pairedRead1: null as string | null,
    pairedRead2: null as string | null,
    singleRead: null as string | null,
    currentSampleId: "",
    currentSampleDate: "",
    sraResetKey: 0,
    isOutputNameValid: true,
  });
  const {
    pairedRead1,
    pairedRead2,
    singleRead,
    currentSampleId,
    currentSampleDate,
    sraResetKey,
    isOutputNameValid,
  } = pageState;
  const setPairedRead1 = setPageState("pairedRead1");
  const setPairedRead2 = setPageState("pairedRead2");
  const setSingleRead = setPageState("singleRead");
  const setCurrentSampleId = setPageState("currentSampleId");
  const setCurrentSampleDate = setPageState("currentSampleDate");
  const setSraResetKey = setPageState("sraResetKey");
  const setIsOutputNameValid = setPageState("isOutputNameValid");
  const skipSraNormalization = useRef(false);

  const primers = useSelector(form.store, (s) => s.values.primers);
  const primerVersionOpts = primerVersionOptions[primers];

  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibraries,
  } = useTanstackLibrarySelection<SarsCov2WastewaterLibraryItem, SrrLibItem>({
    form,
    mapLibraryToItem: (library) => ({
      ...buildBaseLibraryItem(library),
      sample_id: library.sampleId?.trim() ?? library.id,
      ...(library.sampleLevelDate?.trim() && {
        sample_level_date: library.sampleLevelDate.trim(),
      }),
    }),
    mapSraLibraryToItem: (library) => ({
      srr_accession: library.id,
      sample_id: library.sampleId?.trim() ?? library.id,
      ...(library.sampleLevelDate?.trim() && {
        sample_level_date: library.sampleLevelDate.trim(),
      }),
      ...(library.title && { title: library.title }),
    }),
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_libs",
    },
    normalizeLibraries: (nextLibraries, previousLibraries) => {
      // Skip normalization when called from the rerun effect — libs already have correct sampleId
      if (skipSraNormalization.current) {
        skipSraNormalization.current = false;
        return nextLibraries;
      }
      const newSraLibIds = new Set(
        findNewSraLibraries(nextLibraries, previousLibraries).map((l) => l.id),
      );
      return nextLibraries.map((lib) => {
        if (lib.type === "sra" && newSraLibIds.has(lib.id)) {
          return {
            ...lib,
            sampleId: currentSampleId.trim() || lib.id,
            ...(currentSampleDate.trim() && {
              sampleLevelDate: currentSampleDate.trim(),
            }),
          };
        }
        return lib;
      });
    },
  });

  useEffect(() => {
    const defaultVersion = defaultPrimerVersion[primers];
    if (defaultVersion && form.state.values.primer_version !== defaultVersion) {
      form.setFieldValue("primer_version", defaultVersion);
    }
  }, [primers, form]);

  const handlePairedRead1Select = (path: string) => {
    setPairedRead1(path);
    setCurrentSampleId(getDefaultSampleIdFromPath(path));
  };

  const handleSingleReadSelect = (path: string) => {
    setSingleRead(path);
    setCurrentSampleId(getDefaultSampleIdFromPath(path));
  };

  const handlePairedLibraryAdd = () => {
    const { sampleId, sampleLevelDate } = resolveSampleIdAndDate(
      currentSampleId,
      currentSampleDate,
      pairedRead1 ?? undefined,
    );
    addPairedLibrary({
      read1: pairedRead1,
      read2: pairedRead2,
      buildLibrary: getPairedLibraryBuildFn(sampleId, sampleLevelDate),
      onError: (msg) => {
        handleLibraryErrorUtil(msg, toast);
      },
      onAfterAdd: () => {
        setPairedRead1(null);
        setPairedRead2(null);
        setCurrentSampleId("");
      },
    });
  };

  const handleSingleLibraryAdd = () => {
    const { sampleId, sampleLevelDate } = resolveSampleIdAndDate(
      currentSampleId,
      currentSampleDate,
      singleRead ?? undefined,
    );
    addSingleLibrary({
      read: singleRead,
      buildLibrary: getSingleLibraryBuildFn(sampleId, sampleLevelDate),
      duplicateMatcher: singleLibraryDuplicateMatcher,
      onError: (msg) => {
        handleLibraryErrorUtil(msg, toast);
      },
      onAfterAdd: () => {
        setSingleRead(null);
        setCurrentSampleId("");
      },
    });
  };

  const handleSetSelectedLibraries = (libs: Library[]) => {
    const newSraLibs = findNewSraLibraries(libs, selectedLibraries);
    setLibraries(libs);
    if (newSraLibs.length > 0) {
      setCurrentSampleId("");
      setCurrentSampleDate("");
    }
  };

  const handleSraAccessionChange = (value: string) => {
    if (value.trim()) {
      setCurrentSampleId(getDefaultSampleIdFromSrr(value.trim()));
    }
  };

  const handleReset = () => {
    form.reset(defaultSarsCov2WastewaterAnalysisFormValues);
    setLibraries([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setCurrentSampleId("");
    setCurrentSampleDate("");
    setSraResetKey((k) => k + 1);
  };

  const runtime = useServiceRuntime({
    definition: sarsCov2WastewaterAnalysisService,
    form,
    onSuccess: handleReset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (lib, kind) => {
        const base = {
          sampleId: lib.sample_id || "",
          ...(lib.sample_level_date
            ? { sampleLevelDate: lib.sample_level_date }
            : {}),
        };
        if (kind === "sra") {
          return { ...base, ...(lib.title ? { title: lib.title } : {}) };
        }
        return base;
      },
      syncLibraries: (libs) => {
        skipSraNormalization.current = true;
        setLibraries(libs);
      },
    },
  });
  useLayoutEffect(() => {
    submitRef.current = (value) => runtime.submitFormData(value);
  }, [runtime]);
  const { isSubmitting, jobParamsDialogProps } = runtime;
  const page = {
    form,
    pairedRead1,
    pairedRead2,
    singleRead,
    currentSampleId,
    currentSampleDate,
    sraResetKey,
    selectedLibraries,
    primerVersionOpts,
    setPairedRead2,
    setCurrentSampleId,
    setCurrentSampleDate,
    handlePairedRead1Select,
    handleSingleReadSelect,
    handlePairedLibraryAdd,
    handleSingleLibraryAdd,
    handleSetSelectedLibraries,
    handleSraAccessionChange,
  };

  return (
    <section>
      <ServiceHeader
        title="SARS-CoV-2 Wastewater Analysis"
        description="The SARS-CoV-2 Wastewater Analysis assembles raw reads with the Sars One Codex pipeline and performs variant analysis with Freyja."
        infoPopupTitle={sarsCov2WastewaterAnalysisInfo.title}
        infoPopupDescription={sarsCov2WastewaterAnalysisInfo.description}
        quickReferenceGuide={quickReference}
        tutorial={tutorial}
      />

      <form
        action={() => form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="md:col-span-6">
          <WastewaterLibrary page={page} />
        </div>
        <div className="md:col-span-6">
          <WastewaterSelectedLibraries
            libraries={selectedLibraries}
            onRemove={removeLibrary}
          />
        </div>

        <div className="md:col-span-12">
          <WastewaterParameters
            form={form}
            outputPath={outputPath}
            onValidationChange={setIsOutputNameValid}
          />
        </div>

        {/* Form controls */}
        <div className="md:col-span-12">
          <ServiceSubmitError form={form} />
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !canSubmit || !isOutputNameValid}
            >
              {isSubmitting ? <Spinner className="mr-2 size-4" /> : null}
              Submit
            </Button>
          </div>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
