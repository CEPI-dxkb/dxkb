"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useStore } from "@tanstack/react-form";
import {
  FieldItem,
  FieldLabel,
  FieldErrors,
} from "@/components/ui/tanstack-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { Spinner } from "@/components/ui/spinner";
import {
  primerDesignInfo,
  primerDesignInputSequence,
} from "@/lib/services/info/primer-design";
import {
  defaultPrimerDesignFormValues,
  primerDesignFormSchema,
  type PrimerDesignFormData,
} from "@/lib/forms/(genomics)/primer-design/primer-design-form-schema";
import {
  markerLabels,
  primerAdvancedFields,
  primerArrayFields,
  primerScalarFields,
  stripPrimerMarkers,
  validatePrimerDesignSequence,
  type MarkerType,
} from "@/lib/forms/(genomics)/primer-design/primer-design-form-utils";
import { primerDesignService } from "@/lib/forms/(genomics)/primer-design/primer-design-service";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { WorkspaceObject } from "@/lib/services/workspace/types";

export default function PrimerDesignServicePage() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  // Store values for each input type separately
  const [sequenceTextValue, setSequenceTextValue] = useState("");
  const [sequenceTextId, setSequenceTextId] = useState("");
  const [workspaceFastaValue, setWorkspaceFastaValue] = useState("");

  // Track when we're restoring a value to prevent onSelectedObjectChange from clearing it
  const isRestoringValueRef = useRef(false);

  const selectionRangeRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: 0,
  });

  const form = useForm({
    defaultValues: defaultPrimerDesignFormValues as PrimerDesignFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: primerDesignFormSchema as any },
    onSubmit: async ({ value }) => {
      const data = value as PrimerDesignFormData;

      if (data.input_type === "sequence_text") {
        const validation = validatePrimerDesignSequence(data.sequence_input);

        if (!validation.isValid) {
          toast.error(validation.message);
          form.setFieldMeta("sequence_input", (prev) => ({
            ...prev,
            errorMap: { ...prev.errorMap, onChange: validation.message },
          }));
          return;
        }
      }

      await runtime.submitFormData(data);
    },
  });

  const inputType = useStore(form.store, (s) => s.values.input_type);
  const sequenceInput = useStore(form.store, (s) => s.values.sequence_input);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  const sequenceValidation = useMemo(() => {
    if (inputType === "workplace_fasta" || !sequenceInput) return null;
    return validatePrimerDesignSequence(sequenceInput);
  }, [inputType, sequenceInput]);

  useEffect(() => {
    if (!sequenceValidation || sequenceValidation.isValid) {
      form.setFieldMeta("sequence_input", (prev) => ({
        ...prev,
        errorMap: { ...prev.errorMap, onChange: undefined },
      }));
    } else {
      form.setFieldMeta("sequence_input", (prev) => ({
        ...prev,
        errorMap: { ...prev.errorMap, onChange: sequenceValidation.message },
      }));
    }
  }, [sequenceValidation, form]);

  function handleSequenceValueChange(value: string) {
    // Always update the form value with what the user typed (allow typing)
    form.setFieldValue("sequence_input", value);

    // Save to state for sequence_text input type
    if (inputType === "sequence_text") {
      setSequenceTextValue(value);
    }

    const validation = validatePrimerDesignSequence(value);

    if (validation.isValid) {
      form.setFieldMeta("sequence_input", (prev) => ({
        ...prev,
        errorMap: { ...prev.errorMap, onChange: undefined },
      }));

      // When valid, update with sanitized version (matching legacy behavior)
      const sanitized = validation.sanitizedSequence;
      if (sanitized !== value) {
        form.setFieldValue("sequence_input", sanitized);
        // Update state with sanitized value
        if (inputType === "sequence_text") {
          setSequenceTextValue(sanitized);
        }
      }

      // Set sequence identifier from header if present
      if (validation.header) {
        const currentIdentifier = form.state.values.SEQUENCE_ID?.trim() || "";
        if (!currentIdentifier) {
          form.setFieldValue("SEQUENCE_ID", validation.header);
          setSequenceTextId(validation.header);
        }
      }
    } else {
      form.setFieldMeta("sequence_input", (prev) => ({
        ...prev,
        errorMap: { ...prev.errorMap, onChange: validation.message },
      }));
    }
  }

  function handleSequenceSelect(
    event: React.SyntheticEvent<HTMLTextAreaElement>,
  ) {
    const target = event.currentTarget;
    selectionRangeRef.current = {
      start: target.selectionStart ?? 0,
      end: target.selectionEnd ?? 0,
    };
  }

  function updateSequenceWithMarkers(marker: MarkerType) {
    const currentSequence = form.state.values.sequence_input ?? "";
    if (!currentSequence) {
      return;
    }

    if (marker === "clear") {
      const cleared = stripPrimerMarkers(currentSequence);
      handleSequenceValueChange(cleared);
      return;
    }

    const { start, end } = selectionRangeRef.current;
    if (start === end) {
      toast.error("Select a region in the sequence before applying markers.");
      return;
    }

    if (currentSequence.startsWith(">")) {
      const headerEndIndex = currentSequence.indexOf("\n");
      if (headerEndIndex >= 0 && start <= headerEndIndex) {
        toast.error("Markers cannot be added to the FASTA header.");
        return;
      }
    }

    const markers = {
      exclude: ["<", ">"],
      target: ["[", "]"],
      include: ["{", "}"],
    } as const;

    const [openMarker, closeMarker] = markers[marker as keyof typeof markers];
    const markedSequence =
      currentSequence.slice(0, start) +
      openMarker +
      currentSequence.slice(start, end) +
      closeMarker +
      currentSequence.slice(end);

    handleSequenceValueChange(markedSequence);
  }

  function handleWorkspaceSelection(object: WorkspaceObject) {
    const path = object.path || "";
    form.setFieldValue("sequence_input", path);
    // Save to state for workplace_fasta input type
    if (inputType === "workplace_fasta") {
      setWorkspaceFastaValue(path);
    }
  }

  function restoreWorkspaceFasta() {
    if (workspaceFastaValue) {
      isRestoringValueRef.current = true;
      form.setFieldValue("sequence_input", workspaceFastaValue);
      setTimeout(() => {
        isRestoringValueRef.current = false;
      }, 200);
    } else {
      form.setFieldValue("sequence_input", "");
    }
  }

  function restoreSequenceText() {
    form.setFieldValue("sequence_input", sequenceTextValue);
    form.setFieldValue("SEQUENCE_ID", sequenceTextId);
  }

  const runtime = useServiceRuntime({
    definition: primerDesignService,
    form,
    rerun: {
      onApply: (rerunData, form) => {
        const d = rerunData;

        const inputTypeVal = d.input_type as
          | PrimerDesignFormData["input_type"]
          | undefined;
        if (
          inputTypeVal === "sequence_text" ||
          inputTypeVal === "workplace_fasta"
        ) {
          form.setFieldValue("input_type", inputTypeVal as never);
        }

        if (inputTypeVal === "workplace_fasta") {
          const path =
            typeof d.sequence_input === "string" ? d.sequence_input : "";
          isRestoringValueRef.current = true;
          form.setFieldValue("sequence_input", path as never);
          setWorkspaceFastaValue(path);
          setTimeout(() => {
            isRestoringValueRef.current = false;
          }, 200);
        } else {
          const seq =
            typeof d.sequence_input === "string" ? d.sequence_input : "";
          const seqId = typeof d.SEQUENCE_ID === "string" ? d.SEQUENCE_ID : "";
          form.setFieldValue("sequence_input", seq as never);
          form.setFieldValue("SEQUENCE_ID", seqId as never);
          setSequenceTextValue(seq);
          setSequenceTextId(seqId);
        }

        if (typeof d.PRIMER_PICK_INTERNAL_OLIGO === "boolean") {
          form.setFieldValue(
            "PRIMER_PICK_INTERNAL_OLIGO",
            d.PRIMER_PICK_INTERNAL_OLIGO as never,
          );
        }

        for (const field of primerArrayFields) {
          if (d[field] !== undefined) {
            const val = Array.isArray(d[field])
              ? (d[field] as string[])
              : typeof d[field] === "string"
                ? (d[field] as string).trim().split(/\s+/).filter(Boolean)
                : undefined;
            if (val !== undefined) {
              form.setFieldValue(field, val as never);
            }
          }
        }

        for (const field of primerScalarFields) {
          if (d[field] !== undefined) {
            form.setFieldValue(field, String(d[field]) as never);
          }
        }

        const hasAdvancedField = primerAdvancedFields.some(
          (field) => d[field] !== undefined,
        );
        if (hasAdvancedField) {
          setShowAdvanced(true);
        }
      },
    },
  });

  const handleReset = () => {
    form.reset(defaultPrimerDesignFormValues);
    setShowAdvanced(false);
  };

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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
        className="space-y-4"
      >
        <Card className="gap-0">
          <CardHeader className="service-card-header pb-1">
            <CardTitle className="service-card-title">
              Input Sequence
              <DialogInfoPopup
                title={primerDesignInputSequence.title}
                description={primerDesignInputSequence.description}
                sections={primerDesignInputSequence.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 pt-1">
            <Tabs
              value={inputType}
              onValueChange={(value) => {
                const newInputType =
                  value as PrimerDesignFormData["input_type"];
                const previousInputType = form.state.values.input_type;

                // Save current values before switching
                const currentSequenceInput =
                  form.state.values.sequence_input || "";
                if (previousInputType === "sequence_text") {
                  setSequenceTextValue(currentSequenceInput);
                  setSequenceTextId(form.state.values.SEQUENCE_ID || "");
                } else if (previousInputType === "workplace_fasta") {
                  setWorkspaceFastaValue(currentSequenceInput);
                }

                // Update input type
                form.setFieldValue("input_type", newInputType);

                // Restore values for the new input type
                if (newInputType === "sequence_text") {
                  restoreSequenceText();
                } else if (newInputType === "workplace_fasta") {
                  restoreWorkspaceFasta();
                }
              }}
              className="w-full"
            >
              <TabsList>
                <TabsTrigger value="sequence_text">Paste Sequence</TabsTrigger>
                <TabsTrigger value="workplace_fasta">
                  Workspace FASTA
                </TabsTrigger>
              </TabsList>

              <TabsContent value="sequence_text" className="space-y-3">
                <form.Field name="SEQUENCE_ID">
                  {(field) => (
                    <FieldItem>
                      <FieldLabel field={field} className="service-card-label">
                        Sequence Identifier
                      </FieldLabel>
                      <Input
                        name={field.name}
                        id={field.name}
                        value={field.state.value || ""}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          setSequenceTextId(e.target.value);
                        }}
                        placeholder="Identifier for input sequence"
                        className="service-card-input"
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                <form.Field name="sequence_input">
                  {(field) => (
                    <FieldItem>
                      <FieldLabel field={field} className="service-card-label">
                        Paste Sequence
                      </FieldLabel>
                      <Textarea
                        name={field.name}
                        id={field.name}
                        value={field.state.value}
                        onChange={(event) =>
                          handleSequenceValueChange(event.target.value)
                        }
                        onSelect={handleSequenceSelect}
                        onKeyUp={handleSequenceSelect}
                        onMouseUp={handleSequenceSelect}
                        placeholder="Enter nucleotide sequence"
                        className="service-card-textarea"
                      />
                      {sequenceValidation && !sequenceValidation.isValid && (
                        <p className="text-destructive text-sm">
                          {sequenceValidation.message}
                        </p>
                      )}
                      {sequenceValidation && sequenceValidation.isValid && (
                        <p className="text-sm text-green-600">
                          Sequence looks valid.
                        </p>
                      )}
                    </FieldItem>
                  )}
                </form.Field>

                <div className="space-y-2">
                  <Label className="service-card-sublabel">
                    Mark Selected Region
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.keys(markerLabels) as (keyof typeof markerLabels)[]
                    ).map((markerKey) => (
                      <Button
                        key={markerKey}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => updateSequenceWithMarkers(markerKey)}
                      >
                        {markerLabels[markerKey]}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => updateSequenceWithMarkers("clear")}
                    >
                      Clear markers
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="workplace_fasta" className="mt-0">
                <form.Field name="sequence_input">
                  {(field) => (
                    <FieldItem>
                      <FieldLabel field={field} className="service-card-label">
                        FASTA File
                      </FieldLabel>
                      <WorkspaceObjectSelector
                        preset="featureDnaFasta"
                        placeholder="Select FASTA file from workspace"
                        value={field.state.value}
                        onObjectSelect={handleWorkspaceSelection}
                        onSelectedObjectChange={(object) => {
                          // Don't clear if we're currently restoring a value
                          if (isRestoringValueRef.current) {
                            return;
                          }
                          // When user selects an object, update the form and stored value
                          if (object && inputType === "workplace_fasta") {
                            const path = object.path || "";
                            form.setFieldValue("sequence_input", path);
                            setWorkspaceFastaValue(path);
                          } else if (
                            !object &&
                            inputType === "workplace_fasta"
                          ) {
                            // Only clear if user explicitly deselects and we have a value
                            const currentValue =
                              form.state.values.sequence_input;
                            if (currentValue) {
                              form.setFieldValue("sequence_input", "");
                              setWorkspaceFastaValue("");
                            }
                          }
                        }}
                      />
                      <p className="text-muted-foreground text-xs">
                        Note: only the first FASTA record will be used.
                      </p>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              </TabsContent>
            </Tabs>

            <form.Field name="PRIMER_PICK_INTERNAL_OLIGO">
              {(field) => (
                <FieldItem className="flex flex-row items-center gap-2">
                  <FieldLabel field={field} className="service-card-sublabel">
                    Pick Internal Oligo
                  </FieldLabel>
                  <Switch
                    checked={field.state.value ? true : false}
                    onCheckedChange={(checked) => field.handleChange(checked)}
                  />
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <form.Field name="PRIMER_PRODUCT_SIZE_RANGE">
              {(field) => (
                <FieldItem>
                  <div className="flex items-center gap-2">
                    <FieldLabel field={field} className="service-card-label">
                      Product Size Range (bp)
                    </FieldLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <HelpCircle className="service-card-tooltip-icon" />
                          }
                        />
                        <TooltipContent className="max-w-sm">
                          Minimum, optimum, and maximum lengths (in bases) of
                          the PCR product. Primer3 attempts to pick primers
                          close to the optimum length.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={
                      Array.isArray(field.state.value)
                        ? field.state.value.join(" ")
                        : field.state.value || ""
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      field.handleChange(
                        value.trim() ? value.trim().split(/\s+/) : [],
                      );
                    }}
                    placeholder="50-500"
                    className="service-card-input"
                  />
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label className="service-card-label">Primer Size (bp)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <HelpCircle className="service-card-tooltip-icon" />
                      }
                    />
                    <TooltipContent className="max-w-sm">
                      Specify minimum, optimum, and maximum primer lengths.
                      Primer3 will not pick primers shorter than the minimum or
                      longer than the maximum.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(
                  [
                    { label: "Min", name: "PRIMER_MIN_SIZE" },
                    { label: "Opt", name: "PRIMER_OPT_SIZE" },
                    { label: "Max", name: "PRIMER_MAX_SIZE" },
                  ] as const
                ).map(({ label, name }) => (
                  <form.Field key={name} name={name}>
                    {(field) => (
                      <FieldItem>
                        <FieldLabel
                          field={field}
                          className="service-card-sublabel"
                        >
                          {label}
                        </FieldLabel>
                        <Input
                          value={field.state.value || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.handleChange(value || undefined);
                          }}
                          className="service-card-input"
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {(
                [
                  {
                    label: "Excluded Regions",
                    name: "SEQUENCE_EXCLUDED_REGION",
                    prefix: "<",
                    suffix: ">",
                    tooltip:
                      "Space-separated start,length pairs that primers must avoid (e.g. 401,7 68,3).",
                  },
                  {
                    label: "Target Region",
                    name: "SEQUENCE_TARGET",
                    prefix: "[",
                    suffix: "]",
                    tooltip:
                      "Space-separated start,length pairs that primers must flank (e.g. 50,2).",
                  },
                  {
                    label: "Included Regions",
                    name: "SEQUENCE_INCLUDED_REGION",
                    prefix: "{",
                    suffix: "}",
                    tooltip:
                      "Single start,length pair defining the region where primers are allowed (e.g. 20,400).",
                  },
                  {
                    label: "Primer Overlap Positions",
                    name: "SEQUENCE_OVERLAP_JUNCTION_LIST",
                    prefix: "-",
                    suffix: "-",
                    tooltip:
                      "Space-separated positions that at least one primer must overlap.",
                  },
                ] as const
              ).map(({ label, name, prefix, suffix, tooltip }) => (
                <form.Field key={name} name={name}>
                  {(field) => (
                    <FieldItem>
                      <div className="flex items-center gap-2">
                        <FieldLabel
                          field={field}
                          className="service-card-label"
                        >
                          {label}
                        </FieldLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <HelpCircle className="service-card-tooltip-icon" />
                              }
                            />
                            <TooltipContent className="max-w-sm">
                              {tooltip}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{prefix}</span>
                        <Input
                          value={
                            Array.isArray(field.state.value)
                              ? field.state.value.join(" ")
                              : field.state.value || ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            field.handleChange(
                              value.trim() ? value.trim().split(/\s+/) : [],
                            );
                          }}
                          className="service-card-input"
                        />
                        <span>{suffix}</span>
                      </div>
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
              ))}
            </div>

            <Collapsible
              open={showAdvanced}
              onOpenChange={setShowAdvanced}
              className="service-collapsible-container"
            >
              <CollapsibleTrigger className="service-collapsible-trigger">
                Advanced Options
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
                />
              </CollapsibleTrigger>

              <CollapsibleContent className="service-collapsible-content">
                <div className="space-y-3 px-2 py-3">
                  <form.Field name="PRIMER_NUM_RETURN">
                    {(field) => (
                      <FieldItem>
                        <div className="flex items-center gap-2">
                          <FieldLabel
                            field={field}
                            className="service-card-label"
                          >
                            Number to Return
                          </FieldLabel>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <HelpCircle className="service-card-tooltip-icon" />
                                }
                              />
                              <TooltipContent className="max-w-sm">
                                Maximum number of primer pairs to return. Larger
                                values may increase runtime.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <Input
                          value={field.state.value || ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.handleChange(value || undefined);
                          }}
                          placeholder="5"
                          className="service-card-input"
                        />
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Label className="service-card-label">
                        Primer Tm ({"\u00B0"}C)
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <HelpCircle className="service-card-tooltip-icon" />
                            }
                          />
                          <TooltipContent className="max-w-sm">
                            Define minimum, optimum, and maximum melting
                            temperatures as well as the maximum pairwise
                            difference.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                      {(
                        [
                          { label: "Min", name: "PRIMER_MIN_TM" },
                          { label: "Opt", name: "PRIMER_OPT_TM" },
                          { label: "Max", name: "PRIMER_MAX_TM" },
                          {
                            label: "Max \u0394Tm",
                            name: "PRIMER_PAIR_MAX_DIFF_TM",
                          },
                        ] as const
                      ).map(({ label, name }) => (
                        <form.Field key={name} name={name}>
                          {(field) => (
                            <FieldItem>
                              <FieldLabel
                                field={field}
                                className="service-card-sublabel"
                              >
                                {label}
                              </FieldLabel>
                              <Input
                                value={field.state.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.handleChange(value || undefined);
                                }}
                                className="service-card-input"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Label className="service-card-label">Primer GC%</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <HelpCircle className="service-card-tooltip-icon" />
                            }
                          />
                          <TooltipContent className="max-w-sm">
                            Specify acceptable GC content range for designed
                            primers.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {(
                        [
                          { label: "Min", name: "PRIMER_MIN_GC" },
                          { label: "Opt", name: "PRIMER_OPT_GC" },
                          { label: "Max", name: "PRIMER_MAX_GC" },
                        ] as const
                      ).map(({ label, name }) => (
                        <form.Field key={name} name={name}>
                          {(field) => (
                            <FieldItem>
                              <FieldLabel
                                field={field}
                                className="service-card-sublabel"
                              >
                                {label}
                              </FieldLabel>
                              <Input
                                value={field.state.value || ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  field.handleChange(value || undefined);
                                }}
                                className="service-card-input"
                              />
                              <FieldErrors field={field} />
                            </FieldItem>
                          )}
                        </form.Field>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {(
                      [
                        {
                          label: "Concentration of Monovalent Cations (mM)",
                          name: "PRIMER_SALT_MONOVALENT",
                        },
                        {
                          label: "Annealing Oligo Concentration (nM)",
                          name: "PRIMER_DNA_CONC",
                        },
                        {
                          label: "Concentration of Divalent Cations (mM)",
                          name: "PRIMER_SALT_DIVALENT",
                        },
                        {
                          label: "Concentration of dNTPs (mM)",
                          name: "PRIMER_DNTP_CONC",
                        },
                      ] as const
                    ).map(({ label, name }) => (
                      <form.Field key={name} name={name}>
                        {(field) => (
                          <FieldItem>
                            <FieldLabel
                              field={field}
                              className="service-card-label"
                            >
                              {label}
                            </FieldLabel>
                            <Input
                              value={field.state.value || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.handleChange(value || undefined);
                              }}
                              className="service-card-input"
                            />
                            <FieldErrors field={field} />
                          </FieldItem>
                        )}
                      </form.Field>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader className="service-card-header pb-1">
            <CardTitle className="service-card-title">Output</CardTitle>
          </CardHeader>
          <CardContent className="service-card-content space-y-3 pt-1">
            <form.Field name="output_path">
              {(field) => (
                <FieldItem>
                  <OutputFolder
                    required
                    value={field.state.value}
                    onChange={field.handleChange}
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
                    required
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

        <div className="mt-3! flex flex-row justify-end gap-4">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="submit"
            disabled={runtime.isSubmitting || !canSubmit || !isOutputNameValid}
          >
            {runtime.isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
            Submit
          </Button>
        </div>
      </form>

      <JobParamsDialog
        {...runtime.jobParamsDialogProps}
        serviceName="Primer Design"
      />
    </section>
  );
}
