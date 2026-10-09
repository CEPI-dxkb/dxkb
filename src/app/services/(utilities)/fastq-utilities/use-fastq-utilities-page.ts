import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { toast } from "sonner";
import { useServicePageState } from "../../use-service-page-state";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  defaultFastqUtilitiesFormValues,
  fastqUtilitiesFormSchema,
  maxPipelineActions,
  type LibraryItem,
  type PipelineAction,
  type PipelineActionItem,
  type Platform,
} from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-form-schema";
import {
  actionItemsToRecipe,
  createPipelineActionItem,
  isAlignSelected,
  removePipelineActionItem,
} from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-form-utils";
import { fastqUtilitiesService } from "@/lib/forms/(utilities)/fastq-utilities/fastq-utilities-service";
import {
  buildBaseLibraryItem,
  getPairedLibraryName,
  getSingleLibraryName,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";

interface FastqUtilitiesPageState {
  pairedRead1: string | null;
  pairedRead2: string | null;
  singleRead: string | null;
  singlePlatform: Platform;
  sraResetKey: number;
  selectedAction: PipelineAction | "";
  pipelineActions: PipelineActionItem[];
  isOutputNameValid: boolean;
}

export function useFastqUtilitiesPage() {
  const [pageState, setPageState] =
    useServicePageState<FastqUtilitiesPageState>({
      pairedRead1: null,
      pairedRead2: null,
      singleRead: null,
      singlePlatform: "illumina",
      sraResetKey: 0,
      selectedAction: "",
      pipelineActions: [],
      isOutputNameValid: true,
    });
  const form = useForm({
    defaultValues: defaultFastqUtilitiesFormValues,
    validators: { onChange: fastqUtilitiesFormSchema },
    onSubmit: async ({ value }) => runtime.submitFormData(value),
  });
  const outputPath = useSelector(
    form.store,
    (state) => state.values.output_path,
  );
  const recipe = useSelector(form.store, (state) => state.values.recipe);
  const canSubmit = useSelector(form.store, (state) => state.canSubmit);
  const selection = useTanstackLibrarySelection<LibraryItem>({
    form,
    mapLibraryToItem: (library) => ({
      ...buildBaseLibraryItem(library),
      ...(library.type === "single" && {
        platform: (library.platform ?? "illumina") as Platform,
      }),
    }),
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });

  function handleReset() {
    form.reset(defaultFastqUtilitiesFormValues);
    selection.setLibraries([]);
    setPageState("pairedRead1")(null);
    setPageState("pairedRead2")(null);
    setPageState("singleRead")(null);
    setPageState("singlePlatform")("illumina");
    setPageState("pipelineActions")([]);
    setPageState("selectedAction")("");
    setPageState("sraResetKey")((key) => key + 1);
  }

  const runtime = useServiceRuntime({
    definition: fastqUtilitiesService,
    form,
    onSuccess: handleReset,
    rerun: {
      libraries: ["paired", "single", "sra"],
      getLibraryExtra: (library, kind) =>
        kind === "single" ? { platform: library.platform } : {},
      syncLibraries: selection.setLibraries,
      onApply: (rerunData, rerunForm) => {
        const rawRecipe = rerunData.recipe;
        const recipeArray: PipelineAction[] = (
          Array.isArray(rawRecipe)
            ? (rawRecipe as string[])
            : typeof rawRecipe === "string"
              ? [rawRecipe]
              : []
        ).map((action) => action.toLowerCase() as PipelineAction);
        if (recipeArray.length > 0) {
          const actions = recipeArray.map(createPipelineActionItem);
          setPageState("pipelineActions")(actions);
          rerunForm.setFieldValue("recipe", actionItemsToRecipe(actions));
        }
      },
    },
  });

  function handleLibraryError(message: string) {
    if (
      message === "This paired library has already been added" ||
      message === "This single library has already been added"
    ) {
      toast.error("Duplicate library", { description: message });
    } else toast.error(message);
  }
  function handlePairedLibraryAdd() {
    selection.addPairedLibrary({
      read1: pageState.pairedRead1,
      read2: pageState.pairedRead2,
      buildLibrary: (read1, read2, id) => ({
        library: {
          id,
          name: getPairedLibraryName(read1, read2),
          type: "paired",
          files: [read1, read2],
        },
      }),
      onError: handleLibraryError,
      onAfterAdd: () => {
        setPageState("pairedRead1")(null);
        setPageState("pairedRead2")(null);
      },
    });
  }
  function handleSingleLibraryAdd() {
    selection.addSingleLibrary({
      read: pageState.singleRead,
      buildLibrary: (read) => ({
        library: {
          id: read,
          name: getSingleLibraryName(read),
          type: "single",
          files: [read],
          platform: pageState.singlePlatform,
        },
      }),
      duplicateMatcher: (library, read) =>
        library.id === read && library.type === "single",
      onError: handleLibraryError,
      onAfterAdd: () => {
        setPageState("singleRead")(null);
      },
    });
  }
  function handleAddPipelineAction() {
    if (!pageState.selectedAction)
      return void toast.error("Please select an action first");
    if (pageState.pipelineActions.length >= maxPipelineActions) {
      return void toast.error("Maximum actions reached", {
        description: `You can add up to ${String(maxPipelineActions)} pipeline actions`,
      });
    }
    const action = createPipelineActionItem(
      pageState.selectedAction,
      pageState.pipelineActions.length,
    );
    const actions = [...pageState.pipelineActions, action];
    setPageState("pipelineActions")(actions);
    form.setFieldValue("recipe", actionItemsToRecipe(actions));
    setPageState("selectedAction")("");
  }
  function handleRemovePipelineAction(id: string) {
    const removed = pageState.pipelineActions.find(
      (action) => action.id === id,
    );
    const actions = removePipelineActionItem(pageState.pipelineActions, id);
    setPageState("pipelineActions")(actions);
    form.setFieldValue("recipe", actionItemsToRecipe(actions));
    if (
      removed?.action === "align" &&
      !actions.some((action) => action.action === "align")
    ) {
      // Clearing the genome with the Align action must not mark the field
      // touched, or "Target Genome is required" shows the moment Align is
      // added again. `dontUpdateMeta` alone is not enough: `setFieldValue`
      // still validates a mounted field, and that marks it touched. This
      // field stays mounted, disabled, while Align is absent.
      form.setFieldValue("reference_genome_id", "", {
        dontUpdateMeta: true,
        dontValidate: true,
      });
    }
  }

  return {
    ...pageState,
    ...selection,
    form,
    outputPath,
    alignSelected: isAlignSelected(recipe),
    setPairedRead1: setPageState("pairedRead1"),
    setPairedRead2: setPageState("pairedRead2"),
    setSingleRead: setPageState("singleRead"),
    setSinglePlatform: setPageState("singlePlatform"),
    setSelectedAction: setPageState("selectedAction"),
    setIsOutputNameValid: setPageState("isOutputNameValid"),
    handleReset,
    handlePairedLibraryAdd,
    handleSingleLibraryAdd,
    handleAddPipelineAction,
    handleRemovePipelineAction,
    isSubmitting: runtime.isSubmitting,
    jobParamsDialogProps: runtime.jobParamsDialogProps,
    canSubmit: canSubmit && pageState.isOutputNameValid,
  };
}
