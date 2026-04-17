"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { Spinner } from "@/components/ui/spinner";

import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { buildPairedLibraries, buildSingleLibraries } from "@/lib/rerun-utility";
import {
  viralAssemblyInfo,
  viralAssemblyInputFile,
  viralAssemblyParameters,
} from "@/lib/services/info/viral-assembly";

import {
  viralAssemblyFormSchema,
  defaultViralAssemblyFormValues,
  strategyOptions,
  moduleOptions,
  type ViralAssemblyFormData,
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

import type { WorkspaceObject } from "@/lib/workspace-client";
import type { Library } from "@/types/services";

const tutorial =
  "https://www.bv-brc.org/docs/tutorial/viral_assembly/assembly.html";

export const ViralAssemblyPage = function ViralAssemblyPage() {
  const form = useForm({
    defaultValues: defaultViralAssemblyFormValues as ViralAssemblyFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: viralAssemblyFormSchema as any },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value as ViralAssemblyFormData);
    },
  });

  const [pairedRead1, setPairedRead1] = useState<string | null>(null);
  const [pairedRead2, setPairedRead2] = useState<string | null>(null);
  const [singleRead, setSingleRead] = useState<string | null>(null);
  const [sraDefaultValue, setSraDefaultValue] = useState<string>("");
  const [sraResetKey, setSraResetKey] = useState(0);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const inputType = useStore(form.store, (s) => s.values.input_type);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const { selectedLibraries, setLibrariesAndSync, syncLibrariesToForm } =
    useTanstackLibrarySelection<ViralAssemblyLibraryItem, string>({
      form,
      mapLibraryToItem: buildBaseLibraryItem,
      fields: {
        paired: "paired_end_libs",
        single: "single_end_libs",
        srr: "srr_ids",
      },
    });

  const selectedLibrariesRef = useRef(selectedLibraries);
  useEffect(() => {
    selectedLibrariesRef.current = selectedLibraries;
  }, [selectedLibraries]);

  // Sync selected single read into form when Single Read Library is selected (no Add button on this page)
  useEffect(() => {
    if (inputType !== "single") return;
    const desiredSingleId = singleRead ?? null;
    const currentSingleIds = selectedLibrariesRef.current
      .filter((lib) => lib.type === "single")
      .map((lib) => lib.id);
    const alreadyMatches =
      (desiredSingleId === null && currentSingleIds.length === 0) ||
      (desiredSingleId !== null &&
        currentSingleIds.length === 1 &&
        currentSingleIds[0] === desiredSingleId);
    if (alreadyMatches) return;
    const otherLibs = selectedLibrariesRef.current.filter((lib) => lib.type !== "single");
    if (singleRead) {
      const result = getSingleLibraryBuildFn()(singleRead);
      if (result.library) {
        setLibrariesAndSync([...otherLibs, result.library]);
      }
    } else {
      setLibrariesAndSync(otherLibs);
    }
  }, [
    inputType,
    singleRead,
    setLibrariesAndSync,
  ]);

  const currentPairedIdsKey = useMemo(
    () =>
      JSON.stringify(
        selectedLibraries
          .filter((lib) => lib.type === "paired")
          .map((lib) => lib.id),
      ),
    [selectedLibraries],
  );

  // Sync selected paired reads into form when Paired Read Library is selected (no Add button on this page)
  useEffect(() => {
    if (inputType !== "paired") return;
    const desiredPairId =
      pairedRead1 && pairedRead2
        ? getPairedLibraryId(pairedRead1, pairedRead2)
        : null;
    const currentPairedIds = selectedLibrariesRef.current
      .filter((lib) => lib.type === "paired")
      .map((lib) => lib.id);
    const alreadyMatches =
      (desiredPairId === null && currentPairedIds.length === 0) ||
      (desiredPairId !== null &&
        currentPairedIds.length === 1 &&
        currentPairedIds[0] === desiredPairId);
    if (alreadyMatches) return;
    const otherLibs = selectedLibrariesRef.current.filter((lib) => lib.type !== "paired");
    if (pairedRead1 && pairedRead2) {
      const libraryId = getPairedLibraryId(pairedRead1, pairedRead2);
      const result = getPairedLibraryBuildFn()(
        pairedRead1,
        pairedRead2,
        libraryId,
      );
      if (result.library) {
        setLibrariesAndSync([...otherLibs, result.library]);
      }
    } else {
      setLibrariesAndSync(otherLibs);
    }
  }, [
    inputType,
    pairedRead1,
    pairedRead2,
    currentPairedIdsKey,
    setLibrariesAndSync,
  ]);

  const handleReset = () => {
    form.reset(defaultViralAssemblyFormValues);
    setLibrariesAndSync([]);
    setPairedRead1(null);
    setPairedRead2(null);
    setSingleRead(null);
    setSraDefaultValue("");
    setSraResetKey((k) => k + 1);
    setIsOutputNameValid(true);
  };

  const runtime = useServiceRuntime({
    definition: viralAssemblyService,
    form,
    onSuccess: handleReset,
    rerun: {
      onApply: (rerunData, form) => {
        // The transform stores singular fields: paired_end_lib, single_end_lib, srr_id.
        const pairedLib = rerunData.paired_end_lib as
          | Record<string, string>
          | undefined;
        const singleLib = rerunData.single_end_lib as
          | Record<string, string>
          | undefined;
        const srrId = rerunData.srr_id as string | undefined;

        if (pairedLib?.read1 && pairedLib?.read2) {
          form.setFieldValue("input_type", "paired" as never);
          setPairedRead1(pairedLib.read1);
          setPairedRead2(pairedLib.read2);
          const libs = buildPairedLibraries({ paired_end_libs: [pairedLib] });
          syncLibrariesToForm(libs);
          setLibrariesAndSync(libs);
        } else if (singleLib?.read) {
          form.setFieldValue("input_type", "single" as never);
          setSingleRead(singleLib.read);
          const libs = buildSingleLibraries({ single_end_libs: [singleLib] });
          syncLibrariesToForm(libs);
          setLibrariesAndSync(libs);
        } else if (srrId) {
          form.setFieldValue("input_type", "srr_accession" as never);
          setSraDefaultValue(srrId);
          // SraRunAccessionWithValidation reads defaultValue once on mount.
          setSraResetKey((k) => k + 1);
          const libs: Library[] = [{ id: srrId, name: srrId, type: "sra" }];
          syncLibrariesToForm(libs);
          setLibrariesAndSync(libs);
        }
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  return (
    <section>
      <ServiceHeader
        title="Viral Assembly - BETA"
        description="The Viral Assembly Service utilizes IRMA (Iterative Refinement Meta-Assembler) to assemble viral genomes. Users must select the virus genome for processing. This service is currently in beta; any feedback or improvement is welcomed."
        infoPopupTitle={viralAssemblyInfo.title}
        infoPopupDescription={viralAssemblyInfo.description}
        tutorial={tutorial}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="grid grid-cols-1 gap-6 md:grid-cols-12"
      >
        {/* Input File */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Input File
                <DialogInfoPopup
                  title={viralAssemblyInputFile.title}
                  description={viralAssemblyInputFile.description}
                  sections={viralAssemblyInputFile.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>
            <CardContent className="service-card-content space-y-6">
              <form.Field name="input_type">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) =>
                        value != null && field.handleChange(value)
                      }
                      className="service-radio-group-horizontal"
                    >
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem value="paired" id="input-paired" />
                        <Label htmlFor="input-paired">
                          Paired Read Library
                        </Label>
                      </div>
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem value="single" id="input-single" />
                        <Label htmlFor="input-single">
                          Single Read Library
                        </Label>
                      </div>
                      <div className="service-radio-group-item flex items-center gap-2">
                        <RadioGroupItem
                          value="srr_accession"
                          id="input-sra"
                        />
                        <Label htmlFor="input-sra">
                          SRA Run Accession
                        </Label>
                      </div>
                    </RadioGroup>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <div
                className={inputType === "paired" ? "space-y-3" : "hidden"}
                aria-hidden={inputType !== "paired"}
              >
                <WorkspaceObjectSelector
                  types={["reads"]}
                  placeholder="Select READ FILE 1..."
                  value={pairedRead1 ?? ""}
                  onObjectSelect={(object: WorkspaceObject) =>
                    setPairedRead1(object.path)
                  }
                />
                <WorkspaceObjectSelector
                  types={["reads"]}
                  placeholder="Select READ FILE 2..."
                  value={pairedRead2 ?? ""}
                  onObjectSelect={(object: WorkspaceObject) =>
                    setPairedRead2(object.path)
                  }
                />
              </div>

              <div
                className={inputType === "single" ? "space-y-3" : "hidden"}
                aria-hidden={inputType !== "single"}
              >
                <WorkspaceObjectSelector
                  types={["reads"]}
                  placeholder="Select READ FILE..."
                  value={singleRead ?? ""}
                  onObjectSelect={(object: WorkspaceObject) =>
                    setSingleRead(object.path)
                  }
                />
              </div>

              <div
                className={inputType === "srr_accession" ? "block" : "hidden"}
                aria-hidden={inputType !== "srr_accession"}
              >
                <SraRunAccessionWithValidation
                  key={sraResetKey}
                  title="SRA Run Accession"
                  placeholder="SRA Accession"
                  defaultValue={sraDefaultValue}
                  selectedLibraries={selectedLibraries}
                  setSelectedLibraries={setLibrariesAndSync}
                  allowDuplicates={false}
                  showLabel={false}
                  showAddButton={false}
                />
              </div>

              <form.Field name="paired_end_libs">
                {(field) => (
                  <FieldItem>
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Parameters */}
        <div className="md:col-span-12">
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={viralAssemblyParameters.title}
                  sections={viralAssemblyParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>
            <CardContent className="service-card-content space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className="flex-1 space-y-2">
                  <Label className="service-card-label">
                    Assembly Strategy
                  </Label>
                  <form.Field name="strategy">
                    {(field) => (
                      <FieldItem>
                        <Select
                          items={strategyOptions}
                          value={field.state.value}
                          onValueChange={(value) =>
                            value != null && field.handleChange(value)
                          }
                        >
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="Select strategy" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                            {strategyOptions.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                              >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="service-card-label">
                    Reference Database
                  </Label>
                  <form.Field name="module">
                    {(field) => (
                      <FieldItem>
                        <Select
                          items={moduleOptions}
                          value={field.state.value}
                          onValueChange={(value) =>
                            value != null && field.handleChange(value)
                          }
                        >
                          <SelectTrigger className="service-card-select-trigger">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {moduleOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </div>

              <form.Field name="output_path">
                {(field) => (
                  <FieldItem>
                    <OutputFolder
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <form.Field name="output_file">
                {(field) => (
                  <FieldItem>
                    <OutputFolder
                      variant="name"
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      outputFolderPath={outputPath}
                      onValidationChange={setIsOutputNameValid}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            </CardContent>
          </Card>
        </div>

        {/* Form controls */}
        <div className="md:col-span-12">
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || !canSubmit || !isOutputNameValid
              }
            >
              {isSubmitting ? (
                <Spinner className="mr-2 h-4 w-4" />
              ) : null}
              Assemble
            </Button>
          </div>
        </div>
      </form>

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
};

export default ViralAssemblyPage;
