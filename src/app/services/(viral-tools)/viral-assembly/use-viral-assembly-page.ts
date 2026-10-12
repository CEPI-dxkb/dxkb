import { useEffect, useRef } from "react";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
import { useServicePageState } from "../../use-service-page-state";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import {
  buildPairedLibraries,
  buildSingleLibraries,
} from "@/lib/rerun-utility";
import {
  defaultViralAssemblyFormValues,
  viralAssemblyFormSchema,
  type ViralAssemblyLibraryItem,
} from "@/lib/forms/(viral-tools)/viral-assembly/viral-assembly-form-schema";
import {
  getPairedLibraryBuildFn,
  getSingleLibraryBuildFn,
} from "@/lib/forms/(viral-tools)/viral-assembly/viral-assembly-form-utils";
import { viralAssemblyService } from "@/lib/forms/(viral-tools)/viral-assembly/viral-assembly-service";
import {
  buildBaseLibraryItem,
  getPairedLibraryId,
  useTanstackLibrarySelection,
} from "@/lib/forms/tanstack-library-selection";

export function useViralAssemblyPage() {
  const form = useForm({
    defaultValues: defaultViralAssemblyFormValues,
    validators: { onChange: viralAssemblyFormSchema },
    onSubmit: async ({ value }) => runtime.submitFormData(value),
  });
  const [state, setState] = useServicePageState({
    pairedRead1: null as string | null,
    pairedRead2: null as string | null,
    singleRead: null as string | null,
    sraDefaultValue: "",
    sraResetKey: 0,
    isOutputNameValid: true,
  });
  const inputType = useSelector(form.store, (value) => value.values.input_type);
  const strategy = useSelector(form.store, (value) => value.values.strategy);
  const referenceType = useSelector(
    form.store,
    (value) => value.values.reference_type,
  );
  const outputPath = useSelector(
    form.store,
    (value) => value.values.output_path,
  );
  const canSubmit = useSelector(form.store, (value) => value.canSubmit);
  const selection = useTanstackLibrarySelection<ViralAssemblyLibraryItem>({
    form,
    mapLibraryToItem: buildBaseLibraryItem,
    fields: {
      paired: "paired_end_libs",
      single: "single_end_libs",
      srr: "srr_ids",
    },
  });
  const { selectedLibraries, setLibraries } = selection;
  const librariesRef = useRef(selectedLibraries);
  useEffect(() => {
    librariesRef.current = selectedLibraries;
  }, [selectedLibraries]);

  useEffect(() => {
    if (inputType !== "single") return;
    const current = librariesRef.current.filter(
      (library) => library.type === "single",
    );
    if (
      (!state.singleRead && current.length === 0) ||
      (state.singleRead &&
        current.length === 1 &&
        current[0]?.id === state.singleRead)
    )
      return;
    const others = librariesRef.current.filter(
      (library) => library.type !== "single",
    );
    if (state.singleRead) {
      const result = getSingleLibraryBuildFn()(state.singleRead);
      setLibraries(result.library ? [...others, result.library] : others);
    } else setLibraries(others);
  }, [inputType, state.singleRead, setLibraries]);

  const pairedIds = JSON.stringify(
    selectedLibraries.reduce<string[]>((ids, library) => {
      if (library.type === "paired") ids.push(library.id);
      return ids;
    }, []),
  );
  useEffect(() => {
    if (inputType !== "paired") return;
    const desiredId =
      state.pairedRead1 &&
      state.pairedRead2 &&
      state.pairedRead1 !== state.pairedRead2
        ? getPairedLibraryId(state.pairedRead1, state.pairedRead2)
        : null;
    const current = librariesRef.current.filter(
      (library) => library.type === "paired",
    );
    if (
      (!desiredId && current.length === 0) ||
      (desiredId && current.length === 1 && current[0]?.id === desiredId)
    )
      return;
    const others = librariesRef.current.filter(
      (library) => library.type !== "paired",
    );
    if (state.pairedRead1 && state.pairedRead2 && desiredId) {
      const result = getPairedLibraryBuildFn()(
        state.pairedRead1,
        state.pairedRead2,
        desiredId,
      );
      setLibraries(result.library ? [...others, result.library] : others);
    } else setLibraries(others);
  }, [
    inputType,
    state.pairedRead1,
    state.pairedRead2,
    pairedIds,
    setLibraries,
  ]);

  function handleReset() {
    form.reset(defaultViralAssemblyFormValues);
    setLibraries([]);
    setState("pairedRead1")(null);
    setState("pairedRead2")(null);
    setState("singleRead")(null);
    setState("sraDefaultValue")("");
    setState("sraResetKey")((key) => key + 1);
    setState("isOutputNameValid")(true);
  }
  const runtime = useServiceRuntime({
    definition: viralAssemblyService,
    form,
    onSuccess: handleReset,
    rerun: {
      onApply: (data, rerunForm) => {
        const paired = data.paired_end_lib as
          Record<string, string> | undefined;
        const single = data.single_end_lib as
          Record<string, string> | undefined;
        // Legacy sends sra_id; DXKB used to send srr_id. The app takes both.
        const srr = (data.sra_id ?? data.srr_id) as string | undefined;
        if (paired?.read1 && paired.read2) {
          rerunForm.setFieldValue("input_type", "paired");
          setState("pairedRead1")(paired.read1);
          setState("pairedRead2")(paired.read2);
          setLibraries(buildPairedLibraries({ paired_end_libs: [paired] }));
        } else if (single?.read) {
          rerunForm.setFieldValue("input_type", "single");
          setState("singleRead")(single.read);
          setLibraries(buildSingleLibraries({ single_end_libs: [single] }));
        } else if (srr) {
          rerunForm.setFieldValue("input_type", "srr_accession");
          setState("sraDefaultValue")(srr);
          setState("sraResetKey")((key) => key + 1);
        }
      },
    },
  });
  return {
    ...state,
    ...selection,
    form,
    inputType,
    strategy,
    referenceType,
    outputPath,
    handleReset,
    setPairedRead1: setState("pairedRead1"),
    setPairedRead2: setState("pairedRead2"),
    setSingleRead: setState("singleRead"),
    setIsOutputNameValid: setState("isOutputNameValid"),
    isSubmitting: runtime.isSubmitting,
    jobParamsDialogProps: runtime.jobParamsDialogProps,
    canSubmit: canSubmit && state.isOutputNameValid,
  };
}
