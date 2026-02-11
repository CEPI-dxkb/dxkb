"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
} from "@/lib/services/service-info";
import {
  DEFAULT_PRIMER_DESIGN_FORM_VALUES,
  primerDesignFormSchema,
  type PrimerDesignFormData,
  stripPrimerMarkers,
  transformPrimerDesignParams,
  validatePrimerDesignSequence,
  type PrimerSequenceValidationResult,
} from "@/lib/forms/(genomics)";
import { submitServiceJob } from "@/lib/services/service-utils";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { WorkspaceObject } from "@/lib/workspace-client";

const MARKER_LABELS = {
  exclude: "< >",
  target: "[ ]",
  include: "{ }",
} as const;

type MarkerType = keyof typeof MARKER_LABELS | "clear";

export default function PrimerDesignServicePage() {
  const form = useForm<PrimerDesignFormData>({
    resolver: zodResolver(primerDesignFormSchema) as any,
    defaultValues: DEFAULT_PRIMER_DESIGN_FORM_VALUES as PrimerDesignFormData,
    mode: "onChange",
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);
  const [sequenceValidation, setSequenceValidation] =
    useState<PrimerSequenceValidationResult | null>(null);
  
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

  const inputType = form.watch("input_type");
  const sequenceInput = form.watch("sequence_input");

  useEffect(() => {
    if (inputType === "workplace_fasta") {
      setSequenceValidation(null);
      form.clearErrors("sequence_input");
      return;
    }

    if (!sequenceInput) {
      setSequenceValidation(null);
      form.clearErrors("sequence_input");
      return;
    }

    const validation = validatePrimerDesignSequence(sequenceInput);
    setSequenceValidation(validation);

    if (validation.isValid) {
      form.clearErrors("sequence_input");
    } else {
      form.setError("sequence_input", {
        type: "manual",
        message: validation.message,
      });
    }
  }, [inputType, sequenceInput, form]);

  const handleSequenceValueChange = useCallback(
    (value: string) => {
      // Always update the form value with what the user typed (allow typing)
      form.setValue("sequence_input", value, {
        shouldDirty: true,
        shouldValidate: false, // Don't trigger validation again, we'll do it manually
      });
      
      // Save to state for sequence_text input type
      if (inputType === "sequence_text") {
        setSequenceTextValue(value);
      }

      const validation = validatePrimerDesignSequence(value);
      setSequenceValidation(validation);

      if (validation.isValid) {
        form.clearErrors("sequence_input");
        
        // When valid, update with sanitized version (matching legacy behavior)
        const sanitized = validation.sanitizedSequence;
        if (sanitized !== value) {
          form.setValue("sequence_input", sanitized, {
            shouldDirty: true,
            shouldValidate: false,
          });
          // Update state with sanitized value
          if (inputType === "sequence_text") {
            setSequenceTextValue(sanitized);
          }
        }

        // Set sequence identifier from header if present
        if (validation.header) {
          const currentIdentifier = form.getValues("SEQUENCE_ID")?.trim() || "";
          if (!currentIdentifier) {
            form.setValue("SEQUENCE_ID", validation.header, {
              shouldDirty: true,
            });
            setSequenceTextId(validation.header);
          }
        }
      } else {
        form.setError("sequence_input", {
          type: "manual",
          message: validation.message,
        });
      }
    },
    [form, inputType],
  );

  const handleSequenceSelect = useCallback(
    (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
      const target = event.currentTarget;
      selectionRangeRef.current = {
        start: target.selectionStart ?? 0,
        end: target.selectionEnd ?? 0,
      };
    },
    [],
  );

  const updateSequenceWithMarkers = useCallback(
    (marker: MarkerType) => {
      const currentSequence = form.getValues("sequence_input") ?? "";
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
    },
    [form, handleSequenceValueChange],
  );

  const handleWorkspaceSelection = useCallback(
    (object: WorkspaceObject) => {
      const path = object.path || "";
      form.setValue("sequence_input", path, {
        shouldDirty: true,
        shouldValidate: true,
      });
      // Save to state for workplace_fasta input type
      if (inputType === "workplace_fasta") {
        setWorkspaceFastaValue(path);
      }
    },
    [form, inputType],
  );

  // Helper to restore workspace FASTA value
  const restoreWorkspaceFasta = useCallback(() => {
    if (workspaceFastaValue) {
      isRestoringValueRef.current = true;
      form.setValue("sequence_input", workspaceFastaValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setTimeout(() => {
        isRestoringValueRef.current = false;
      }, 200);
    } else {
      form.setValue("sequence_input", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [workspaceFastaValue, form]);

  // Helper to restore sequence text values
  const restoreSequenceText = useCallback(() => {
    form.setValue("sequence_input", sequenceTextValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("SEQUENCE_ID", sequenceTextId, {
      shouldDirty: true,
    });
  }, [sequenceTextValue, sequenceTextId, form]);

  const handleReset = () => {
    form.reset(DEFAULT_PRIMER_DESIGN_FORM_VALUES);
    setSequenceValidation(null);
    setShowAdvanced(false);
  };

  const {
    handleSubmit: handleFormSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
  } = useServiceFormSubmission<PrimerDesignFormData>({
    serviceName: "Primer Design",
    transformParams: transformPrimerDesignParams,
    onSubmit: async (data) => {
      if (data.input_type === "sequence_text") {
        const validation = validatePrimerDesignSequence(data.sequence_input);
        setSequenceValidation(validation);

        if (!validation.isValid) {
          toast.error(validation.message);
          form.setError("sequence_input", {
            type: "manual",
            message: validation.message,
          });
          return;
        }
      }

      try {
        setIsSubmitting(true);
        const result = await submitServiceJob(
          "PrimerDesign",
          transformPrimerDesignParams(data),
        );

        if (result.success) {
          const jobId = result.job?.[0]?.id;
          toast.success("Primer Design job submitted", {
            description: jobId ? `Job ID: ${jobId}` : undefined,
          });
        } else {
          throw new Error(result.error || "Failed to submit Primer Design job");
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to submit Primer Design job";
        toast.error("Submission failed", { description: message });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

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

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleFormSubmit)}
          className="service-form-section"
        >
          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">
                Input Sequence
                <DialogInfoPopup
                  title={primerDesignInputSequence.title}
                  description={primerDesignInputSequence.description}
                  sections={primerDesignInputSequence.sections}
                />
              </CardTitle>
            </CardHeader>

            <CardContent className="service-card-content space-y-6">
              <Tabs
                value={inputType}
                onValueChange={(value) => {
                  const newInputType = value as PrimerDesignFormData["input_type"];
                  const previousInputType = form.getValues("input_type");
                  
                  // Save current values before switching
                  const currentSequenceInput = form.getValues("sequence_input") || "";
                  if (previousInputType === "sequence_text") {
                    setSequenceTextValue(currentSequenceInput);
                    setSequenceTextId(form.getValues("SEQUENCE_ID") || "");
                  } else if (previousInputType === "workplace_fasta") {
                    setWorkspaceFastaValue(currentSequenceInput);
                  }
                  
                  // Update input type
                  form.setValue("input_type", newInputType, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  
                  // Restore values for the new input type
                  if (newInputType === "sequence_text") {
                    restoreSequenceText();
                  } else if (newInputType === "workplace_fasta") {
                    restoreWorkspaceFasta();
                  }
                  
                  // Clear validation state when switching
                  setSequenceValidation(null);
                }}
                className="w-full"
              >
                <TabsList className="mb-4 grid w-full grid-cols-2">
                  <TabsTrigger value="sequence_text">
                    Paste Sequence
                  </TabsTrigger>
                  <TabsTrigger value="workplace_fasta">
                    Workspace FASTA
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sequence_text" className="mt-0 space-y-6">
                  <FormField
                    control={form.control}
                    name="SEQUENCE_ID"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label ">
                          Sequence Identifier
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value || ""}
                            onChange={(e) => {
                              field.onChange(e);
                              setSequenceTextId(e.target.value);
                            }}
                            placeholder="Identifier for input sequence"
                            className="service-card-input"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sequence_input"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label ">
                          Paste Sequence
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            ref={field.ref}
                            value={field.value}
                            onChange={(event) =>
                              handleSequenceValueChange(event.target.value)
                            }
                            onSelect={handleSequenceSelect}
                            onKeyUp={handleSequenceSelect}
                            onMouseUp={handleSequenceSelect}
                            placeholder="Enter nucleotide sequence"
                            className="service-card-textarea"
                          />
                        </FormControl>
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
                      </FormItem>
                    )}
                  />

                  <div className="space-y-2">
                    <Label className="service-card-sublabel">
                      Mark Selected Region
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {(
                        Object.keys(MARKER_LABELS) as Array<
                          keyof typeof MARKER_LABELS
                        >
                      ).map((markerKey) => (
                        <Button
                          key={markerKey}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateSequenceWithMarkers(markerKey)}
                        >
                          {MARKER_LABELS[markerKey]}
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
                  <FormField
                    control={form.control}
                    name="sequence_input"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label ">
                          FASTA File
                        </FormLabel>
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={["feature_dna_fasta"]}
                            placeholder="Select FASTA file from workspace"
                            value={field.value}
                            onObjectSelect={handleWorkspaceSelection}
                            onSelectedObjectChange={(object) => {
                              // Don't clear if we're currently restoring a value
                              if (isRestoringValueRef.current) {
                                return;
                              }
                              // When user selects an object, update the form and stored value
                              if (object && inputType === "workplace_fasta") {
                                const path = object.path || "";
                                form.setValue("sequence_input", path, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                                setWorkspaceFastaValue(path);
                              } else if (!object && inputType === "workplace_fasta") {
                                // Only clear if user explicitly deselects and we have a value
                                const currentValue = form.getValues("sequence_input");
                                if (currentValue) {
                                  form.setValue("sequence_input", "", {
                                    shouldDirty: true,
                                    shouldValidate: true,
                                  });
                                  setWorkspaceFastaValue("");
                                }
                              }
                            }}
                          />
                        </FormControl>
                        <p className="text-muted-foreground text-xs">
                          Note: only the first FASTA record will be used.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <FormField
                control={form.control}
                name="PRIMER_PICK_INTERNAL_OLIGO"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3">
                    <FormLabel className="service-card-sublabel ">
                      Pick Internal Oligo
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value ? true : false}
                        onCheckedChange={(checked) =>
                          field.onChange(checked)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="PRIMER_PRODUCT_SIZE_RANGE"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel className="service-card-label ">
                        Product Size Range (bp)
                      </FormLabel>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="service-card-tooltip-icon mb-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            Minimum, optimum, and maximum lengths (in bases) of
                            the PCR product. Primer3 attempts to pick primers
                            close to the optimum length.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Input
                        value={
                          Array.isArray(field.value)
                            ? field.value.join(" ")
                            : field.value || ""
                        }
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(
                            value.trim() ? value.trim().split(/\s+/) : [],
                          );
                        }}
                        placeholder="50-500"
                        className="service-card-input"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FormLabel className="service-card-label ">Primer Size (bp)</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="service-card-tooltip-icon mb-2" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        Specify minimum, optimum, and maximum primer lengths.
                        Primer3 will not pick primers shorter than the minimum
                        or longer than the maximum.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {(
                    [
                      { label: "Min", name: "PRIMER_MIN_SIZE" },
                      { label: "Opt", name: "PRIMER_OPT_SIZE" },
                      { label: "Max", name: "PRIMER_MAX_SIZE" },
                    ] as const
                  ).map(({ label, name }) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={name}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="service-card-sublabel ">
                            {label}
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value || undefined);
                              }}
                              className="service-card-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
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
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <FormLabel className="service-card-label ">
                            {label}
                          </FormLabel>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="service-card-tooltip-icon mb-2" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm">
                                {tooltip}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{prefix}</span>
                          <FormControl>
                            <Input
                              value={
                                Array.isArray(field.value)
                                  ? field.value.join(" ")
                                  : field.value || ""
                              }
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(
                                  value.trim() ? value.trim().split(/\s+/) : [],
                                );
                              }}
                              className="service-card-input"
                            />
                          </FormControl>
                          <span>{suffix}</span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                  <div className="space-y-6 px-2 py-4">
                    <FormField
                      control={form.control}
                      name="PRIMER_NUM_RETURN"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormLabel className="service-card-label ">
                              Number to Return
                            </FormLabel>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <HelpCircle className="service-card-tooltip-icon mb-2" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  Maximum number of primer pairs to return.
                                  Larger values may increase runtime.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <FormControl>
                            <Input
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value || undefined);
                              }}
                              placeholder="5"
                              className="service-card-input"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <FormLabel className="service-card-label ">
                          Primer Tm (°C)
                        </FormLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="service-card-tooltip-icon mb-2" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              Define minimum, optimum, and maximum melting
                              temperatures as well as the maximum pairwise
                              difference.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                        {(
                          [
                            { label: "Min", name: "PRIMER_MIN_TM" },
                            { label: "Opt", name: "PRIMER_OPT_TM" },
                            { label: "Max", name: "PRIMER_MAX_TM" },
                            {
                              label: "Max ΔTm",
                              name: "PRIMER_PAIR_MAX_DIFF_TM",
                            },
                          ] as const
                        ).map(({ label, name }) => (
                          <FormField
                            key={name}
                            control={form.control}
                            name={name}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel ">
                                  {label}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(value || undefined);
                                    }}
                                    className="service-card-input"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <FormLabel className="service-card-label ">Primer GC%</FormLabel>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="service-card-tooltip-icon mb-2" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              Specify acceptable GC content range for designed
                              primers.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        {(
                          [
                            { label: "Min", name: "PRIMER_MIN_GC" },
                            { label: "Opt", name: "PRIMER_OPT_GC" },
                            { label: "Max", name: "PRIMER_MAX_GC" },
                          ] as const
                        ).map(({ label, name }) => (
                          <FormField
                            key={name}
                            control={form.control}
                            name={name}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="service-card-sublabel ">
                                  {label}
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    value={field.value || ""}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      field.onChange(value || undefined);
                                    }}
                                    className="service-card-input"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                        <FormField
                          key={name}
                          control={form.control}
                          name={name}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="service-card-label ">
                                {label}
                              </FormLabel>
                              <FormControl>
                                <Input
                                  value={field.value || ""}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    field.onChange(value || undefined);
                                  }}
                                  className="service-card-input"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="service-card-header">
              <CardTitle className="service-card-title">Output</CardTitle>
            </CardHeader>
            <CardContent className="service-card-content space-y-6">
              <FormField
                control={form.control}
                name="output_path"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <OutputFolder
                        required
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="output_file"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <OutputFolder
                        variant="name"
                        required
                        value={field.value}
                        onChange={(value) => field.onChange(value)}
                        outputFolderPath={form.watch("output_path")}
                        onValidationChange={setIsOutputNameValid}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}
            >
              {isSubmitting && <Spinner className="mr-2 h-4 w-4" />}
              Submit
            </Button>
          </div>
        </form>
      </Form>

      <JobParamsDialog
        open={showParamsDialog}
        onOpenChange={setShowParamsDialog}
        params={currentParams}
        serviceName="Primer Design"
      />
    </section>
  );
}
