"use client";

import { useEffect, useReducer, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ServiceHeader } from "@/components/services/service-header";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { genomeAssemblyInfo } from "@/lib/services/info/genome-assembly";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  genomeAssemblyFormSchema,
  defaultGenomeAssemblyFormValues,
  type GenomeAssemblyFormData,
  type LibraryItem,
} from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-form-schema";
import { genomeAssemblyService } from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-service";
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";
import type { Library } from "@/types/services";
import {
  AssemblyInputs,
  AssemblyParameters,
  SelectedLibraries,
} from "./assembly-sections";

export interface AssemblyUiState {
  showAdvanced: boolean;
  genomeSizeUnit: "M" | "K";
  expectedGenomeSize: number;
  pairedRead1: string | null;
  pairedRead2: string | null;
  singleRead: string | null;
  isOutputNameValid: boolean;
  sraResetKey: number;
}
export type AssemblyAction =
  | { type: "reset" }
  | { type: "set-advanced"; value: boolean }
  | { type: "set-unit"; unit: "M" | "K" }
  | { type: "set-genome-size"; value: number }
  | { type: "set-output-valid"; value: boolean }
  | {
      type: "set-read";
      read: "pairedRead1" | "pairedRead2" | "singleRead";
      value: string | null;
    }
  | { type: "clear-paired" };
const initialUiState: AssemblyUiState = {
  showAdvanced: false,
  genomeSizeUnit: "M",
  expectedGenomeSize: 5,
  pairedRead1: null,
  pairedRead2: null,
  singleRead: null,
  isOutputNameValid: true,
  sraResetKey: 0,
};
function uiReducer(
  state: AssemblyUiState,
  action: AssemblyAction,
): AssemblyUiState {
  switch (action.type) {
    case "reset":
      return { ...initialUiState, sraResetKey: state.sraResetKey + 1 };
    case "set-advanced":
      return state.showAdvanced === action.value
        ? state
        : { ...state, showAdvanced: action.value };
    case "set-unit":
      return state.genomeSizeUnit === action.unit
        ? state
        : {
            ...state,
            genomeSizeUnit: action.unit,
            expectedGenomeSize: action.unit === "M" ? 5 : 500,
          };
    case "set-genome-size":
      return state.expectedGenomeSize === action.value
        ? state
        : { ...state, expectedGenomeSize: action.value };
    case "set-output-valid":
      return state.isOutputNameValid === action.value
        ? state
        : { ...state, isOutputNameValid: action.value };
    case "set-read":
      return state[action.read] === action.value
        ? state
        : { ...state, [action.read]: action.value };
    case "clear-paired":
      return { ...state, pairedRead1: null, pairedRead2: null };
  }
}
function mapLibrary(library: Library): LibraryItem {
  if (library.type === "paired")
    return {
      ...buildBaseLibraryItem(library),
      platform: library.platform || "infer",
      interleaved: library.interleaved || false,
      read_orientation_outward: library.read_orientation_outward || false,
    };
  if (library.type === "single")
    return {
      ...buildBaseLibraryItem(library),
      platform: library.platform || "infer",
    };
  return buildBaseLibraryItem(library);
}
function useAssemblyForm(
  submit: (value: GenomeAssemblyFormData) => Promise<void>,
) {
  return useForm({
    defaultValues: defaultGenomeAssemblyFormValues,
    validators: { onChange: genomeAssemblyFormSchema },
    onSubmit: async ({ value }) => submit(value),
  });
}
export type AssemblyForm = ReturnType<typeof useAssemblyForm>;

export default function GenomeAssemblyPage() {
  const [state, dispatch] = useReducer(uiReducer, initialUiState);
  const submitRef = useRef<(value: GenomeAssemblyFormData) => Promise<void>>(
    () => Promise.resolve(),
  );
  const form = useAssemblyForm((value) => submitRef.current(value));
  const {
    selectedLibraries,
    addPairedLibrary,
    addSingleLibrary,
    removeLibrary,
    setLibraries,
  } = useTanstackLibrarySelection<LibraryItem>({
    form,
    mapLibraryToItem: mapLibrary,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });
  const reset = () => {
    form.reset(defaultGenomeAssemblyFormValues);
    setLibraries([]);
    dispatch({ type: "reset" });
  };
  const runtime = useServiceRuntime({
    definition: genomeAssemblyService,
    form,
    onSuccess: reset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (library, kind) =>
        kind === "paired"
          ? {
              platform: library.platform || "infer",
              interleaved: !!library.interleaved,
              read_orientation_outward: !!library.read_orientation_outward,
            }
          : kind === "single"
            ? { platform: library.platform || "infer" }
            : {},
      syncLibraries: setLibraries,
    },
  });
  const recipe = useSelector(form.store, (value) => value.values.recipe);
  const outputPath = useSelector(
    form.store,
    (value) => value.values.output_path,
  );
  const canSubmit = useSelector(form.store, (value) => value.canSubmit);
  useEffect(() => {
    submitRef.current = async (value) => {
      if (
        !value.paired_end_libs?.length &&
        !value.single_end_libs?.length &&
        !value.srr_ids?.length
      ) {
        toast.error("At least one library must be selected");
        return;
      }
      await runtime.submitFormData(value);
    };
  }, [runtime]);
  const addPaired = () => {
    addPairedLibrary({
      read1: state.pairedRead1,
      read2: state.pairedRead2,
      buildLibrary: (read1, read2, id) => ({
        library: {
          id,
          name: getPairedLibraryName(read1, read2),
          type: "paired",
          files: [read1, read2],
          platform: "infer",
          interleaved: false,
          read_orientation_outward: false,
        },
      }),
      onError: toast.error,
      onAfterAdd: () => {
        dispatch({ type: "clear-paired" });
      },
    });
  };
  const addSingle = () => {
    addSingleLibrary({
      read: state.singleRead,
      buildLibrary: (read) => ({
        library: {
          id: read,
          name: getSingleLibraryName(read),
          type: "single",
          files: [read],
          platform: "infer",
        },
      }),
      onError: toast.error,
      onAfterAdd: () => {
        dispatch({ type: "set-read", read: "singleRead", value: null });
      },
    });
  };

  return (
    <section>
      <ServiceHeader
        title="Genome Assembly"
        description="The Genome Assembly Service allows single or multiple assemblers to be invoked to compare results. The service attempts to select the best assembly."
        infoPopupTitle={genomeAssemblyInfo.title}
        infoPopupDescription={genomeAssemblyInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />
      <form
        action={() => form.handleSubmit()}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        <div className="space-y-6 md:col-span-7">
          <AssemblyInputs
            state={state}
            dispatch={dispatch}
            libraries={selectedLibraries}
            setLibraries={setLibraries}
            addPaired={addPaired}
            addSingle={addSingle}
          />
          <SelectedLibraries
            mobile
            libraries={selectedLibraries}
            onRemove={removeLibrary}
          />
          <AssemblyParameters
            form={form}
            state={state}
            dispatch={dispatch}
            outputPath={outputPath}
            showGenomeSize={recipe === "canu"}
          />
        </div>
        <SelectedLibraries
          libraries={selectedLibraries}
          onRemove={removeLibrary}
        />
        <div className="service-form-controls md:col-span-12">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                runtime.isSubmitting || !canSubmit || !state.isOutputNameValid
              }
            >
              {runtime.isSubmitting ? <Spinner /> : null}Assemble
            </Button>
          </div>
        </div>
      </form>
      <JobParamsDialog {...runtime.jobParamsDialogProps} />
    </section>
  );
}
