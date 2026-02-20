"use client";

import { useState, useCallback, useMemo } from "react";
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
import { ServiceHeader } from "@/components/services/service-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, Plus } from "lucide-react";
import {
  metaCATSInfo,
  metaCATSParameters,
  metaCATSInput,
} from "@/lib/services/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/workspace-client";
import { submitServiceJob } from "@/lib/services/service-utils";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SelectedItemsTable from "@/components/services/selected-items-table";
import {
  metaCatsFormSchema,
  DEFAULT_META_CATS_FORM_VALUES,
  METADATA_OPTIONS,
  MAX_GROUPS,
  MIN_GROUPS,
  type MetaCatsFormData,
  type AutoGroupItem,
} from "@/lib/forms/(protein-tools)/meta-cats/meta-cats-form-schema";
import {
  transformMetaCatsParams,
  getMetaCatsDisplayName,
  countUniqueGroups,
  getUniqueGroupNames,
  validateYearRanges,
  createGenomeIdMapFromFeatures,
  buildMetaCatsAutoGroupsFromGenomes,
  removeAutoGroupsByRowIds,
  updateAutoGroupsGroupByRowIds,
} from "@/lib/forms/(protein-tools)/meta-cats/meta-cats-form-utils";
import { fetchFeaturesFromGroup, type FeatureSummary } from "@/lib/services/feature";
import { fetchGenomesByIds, type GenomeSummary } from "@/lib/services/genome";

export default function MetaCATSPage() {
  const form = useForm<MetaCatsFormData>({
    resolver: zodResolver(metaCatsFormSchema),
    defaultValues: DEFAULT_META_CATS_FORM_VALUES,
    mode: "onChange",
  });

  // State for auto grouping
  const [selectedAutoFeatureGroupObject, setSelectedAutoFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [isLoadingAutoGroup, setIsLoadingAutoGroup] = useState(false);
  const [selectedGridRows, setSelectedGridRows] = useState<Set<string>>(new Set());
  const [groupNames, setGroupNames] = useState<string[]>([]);
  const [selectedGroupName, setSelectedGroupName] = useState<string>("");
  const [yearRangesInput, setYearRangesInput] = useState<string>("");
  const [yearRangesValidation, setYearRangesValidation] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // State for feature groups mode
  const [selectedFeatureGroupObject, setSelectedFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);

  // State for alignment file mode
  const [selectedAlignmentFileObject, setSelectedAlignmentFileObject] =
    useState<WorkspaceObject | null>(null);
  const [selectedGroupFileObject, setSelectedGroupFileObject] =
    useState<WorkspaceObject | null>(null);

  // General state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const inputType = form.watch("input_type");
  const metadataGroup = form.watch("metadata_group");
  const autoGroups = form.watch("auto_groups") || [];
  const featureGroups = form.watch("groups") || [];

  // Calculate unique group count
  const uniqueGroupCount = useMemo(() => {
    return countUniqueGroups(autoGroups);
  }, [autoGroups]);

  // Determine if year ranges should be shown
  const showYearRanges = metadataGroup === "collection_year";

  // Validate year ranges when input changes
  const handleYearRangesChange = useCallback((value: string) => {
    setYearRangesInput(value);
    const validation = validateYearRanges(value);
    setYearRangesValidation(validation);
    form.setValue("year_ranges", value);
  }, [form]);

  // Handle adding feature group to auto grouping grid
  const handleAddAutoFeatureGroup = useCallback(async () => {
    if (!selectedAutoFeatureGroupObject?.path) {
      toast.error("No feature group selected", {
        description: "Please select a feature group before adding.",
        closeButton: true,
      });
      return;
    }

    const featureGroupPath = selectedAutoFeatureGroupObject.path;
    const currentMetadataGroup = form.getValues("metadata_group") || "host_name";
    const yearRanges = form.getValues("year_ranges") || "";

    setIsLoadingAutoGroup(true);

    try {
      // Fetch features from the feature group
      const features = await fetchFeaturesFromGroup(featureGroupPath);

      if (features.length === 0) {
        toast.error("Empty feature group", {
          description: "The selected feature group has no features.",
          closeButton: true,
        });
        setIsLoadingAutoGroup(false);
        return;
      }

      // Get unique genome IDs from features
      const genomeIdMap = createGenomeIdMapFromFeatures(features);
      const genomeIds = Array.from(genomeIdMap.keys());

      // Fetch genome metadata
      const genomes = await fetchGenomesByIds(genomeIds);

      const { newAutoGroups, nextGroupNames } = buildMetaCatsAutoGroupsFromGenomes({
        genomes: genomes as unknown as (GenomeSummary & Record<string, unknown>)[],
        genomeIdMap,
        metadataGroup: currentMetadataGroup,
        yearRanges,
        existingAutoGroups: autoGroups,
        existingGroupNames: groupNames,
      });

      // Update form and state
      form.setValue("auto_groups", [...autoGroups, ...newAutoGroups], {
        shouldValidate: true,
      });
      setGroupNames(nextGroupNames);
      setSelectedAutoFeatureGroupObject(null);

      if (newAutoGroups.length > 0) {
        toast.success(`Added ${newAutoGroups.length} feature(s)`, {
          closeButton: true,
        });
      } else {
        toast.info("No new features added", {
          description: "All features from this group are already in the grid.",
          closeButton: true,
        });
      }
    } catch (error) {
      console.error("Failed to add feature group:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to add feature group";
      toast.error("Failed to add feature group", {
        description: errorMessage,
        closeButton: true,
      });
    } finally {
      setIsLoadingAutoGroup(false);
    }
  }, [selectedAutoFeatureGroupObject, form, autoGroups, groupNames]);

  // Handle deleting selected rows from grid
  const handleDeleteSelectedRows = useCallback(() => {
    if (selectedGridRows.size === 0) return;

    const updatedAutoGroups = removeAutoGroupsByRowIds(autoGroups, selectedGridRows);
    form.setValue("auto_groups", updatedAutoGroups, { shouldValidate: true });

    // Update group names
    const remainingGroupNames = getUniqueGroupNames(updatedAutoGroups);
    setGroupNames(remainingGroupNames);
    setSelectedGridRows(new Set());

    toast.success(`Deleted ${selectedGridRows.size} row(s)`, { closeButton: true });
  }, [selectedGridRows, autoGroups, form]);

  // Handle changing group for selected rows
  const handleChangeGroup = useCallback(() => {
    if (!selectedGroupName || selectedGridRows.size === 0) {
      toast.error("Select rows and enter a group name", { closeButton: true });
      return;
    }

    const updatedAutoGroups = updateAutoGroupsGroupByRowIds(
      autoGroups,
      selectedGridRows,
      selectedGroupName
    );

    form.setValue("auto_groups", updatedAutoGroups, { shouldValidate: true });

    // Update group names
    const newGroupNames = new Set(groupNames);
    newGroupNames.add(selectedGroupName);
    setGroupNames(Array.from(newGroupNames));

    toast.success(`Changed group for ${selectedGridRows.size} row(s)`, {
      closeButton: true,
    });
  }, [selectedGroupName, selectedGridRows, autoGroups, form, groupNames]);

  // Handle selecting all rows
  const handleSelectAllRows = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedGridRows(new Set(autoGroups.map((item) => item.id)));
      } else {
        setSelectedGridRows(new Set());
      }
    },
    [autoGroups]
  );

  // Handle row selection toggle
  const handleRowSelect = useCallback((id: string) => {
    setSelectedGridRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Handle adding feature group in feature groups mode
  const handleAddFeatureGroup = useCallback(() => {
    if (!selectedFeatureGroupObject?.path) {
      toast.error("No feature group selected", {
        description: "Please select a feature group before adding.",
        closeButton: true,
      });
      return;
    }

    const path = selectedFeatureGroupObject.path;

    // Check for duplicates
    if (featureGroups.includes(path)) {
      toast.error("Feature group already added", {
        description: "This feature group is already in the list.",
        closeButton: true,
      });
      return;
    }

    // Check max limit
    if (featureGroups.length >= MAX_GROUPS) {
      toast.error("Maximum groups reached", {
        description: `Maximum of ${MAX_GROUPS} feature groups allowed.`,
        closeButton: true,
      });
      return;
    }

    form.setValue("groups", [...featureGroups, path], { shouldValidate: true });
    setSelectedFeatureGroupObject(null);
  }, [selectedFeatureGroupObject, featureGroups, form]);

  // Handle removing feature group
  const handleRemoveFeatureGroup = useCallback(
    (path: string) => {
      const updatedGroups = featureGroups.filter((g) => g !== path);
      form.setValue("groups", updatedGroups, { shouldValidate: true });
    },
    [featureGroups, form]
  );

  // Handle reset
  const handleReset = useCallback(() => {
    form.reset(DEFAULT_META_CATS_FORM_VALUES);
    setSelectedAutoFeatureGroupObject(null);
    setSelectedFeatureGroupObject(null);
    setSelectedAlignmentFileObject(null);
    setSelectedGroupFileObject(null);
    setSelectedGridRows(new Set());
    setGroupNames([]);
    setSelectedGroupName("");
    setYearRangesInput("");
    setYearRangesValidation(null);
  }, [form]);

  // Setup service form submission
  const {
    handleSubmit,
    showParamsDialog,
    setShowParamsDialog,
    currentParams,
    serviceName,
  } = useServiceFormSubmission<MetaCatsFormData>({
    serviceName: "MetaCATS",
    transformParams: transformMetaCatsParams,
    onSubmit: async (data) => {
      try {
        setIsSubmitting(true);
        const result = await submitServiceJob(
          "MetaCATS",
          transformMetaCatsParams(data)
        );

        if (result.success) {
          console.log("MetaCATS job submitted successfully:", result.job?.[0]);

          toast.success("MetaCATS job submitted successfully!", {
            description: result.job?.[0]?.id
              ? `Job ID: ${result.job[0].id}`
              : "Job submitted successfully",
            closeButton: true,
          });

          handleReset();
        } else {
          throw new Error(result.error || "Failed to submit job");
        }
      } catch (error) {
        console.error("Failed to submit MetaCATS job:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to submit MetaCATS job";
        toast.error("Submission failed", {
          description: errorMessage,
          closeButton: true,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <section>
      <ServiceHeader
        title="Metadata-driven Comparative Analysis Tool (Meta-CATS)"
        description="The Meta-CATS tool looks for positions that significantly differ between user-defined groups of sequences.
          However, biological biases due to covariation, codon biases, and differences in genotype, geography, time of isolation,
          or others may affect the robustness of the underlying statistical assumptions."
        infoPopupTitle={metaCATSInfo.title}
        infoPopupDescription={metaCATSInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/metacats.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/metacats/metacats.html"
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-4"
        >
          {/* Parameters Card */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Parameters
                <DialogInfoPopup
                  title={metaCATSParameters.title}
                  description={metaCATSParameters.description}
                  sections={metaCATSParameters.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="service-card-content">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="p_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="service-card-label">P-Value</FormLabel>
                      <FormControl>
                        <NumberInput
                          ref={field.ref}
                          name={field.name}
                          value={field.value}
                          min={0}
                          max={1}
                          stepper={0.01}
                          decimalScale={2}
                          onBlur={field.onBlur}
                          onValueChange={(value) => {
                            if (value !== undefined) field.onChange(value);
                          }}
                          className="relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none service-card-input max-w-32"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col space-y-4">
                  <FormField
                    control={form.control}
                    name="output_path"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <OutputFolder
                            required={true}
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
                            required={true}
                            value={field.value}
                            onChange={field.onChange}
                            outputFolderPath={form.watch("output_path")}
                            onValidationChange={setIsOutputNameValid}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input Card */}
          <Card>
            <CardHeader className="service-card-header">
              <RequiredFormCardTitle className="service-card-title">
                Input
                <DialogInfoPopup
                  title={metaCATSInput.title}
                  description={metaCATSInput.description}
                  sections={metaCATSInput.sections}
                />
              </RequiredFormCardTitle>
            </CardHeader>

            <CardContent className="space-y-6 pt-1">
              <div className="flex flex-col gap-6">
                {/* Input Type Selection */}
                <FormField
                  control={form.control}
                  name="input_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          value={field.value}
                          onValueChange={field.onChange}
                          className="service-radio-group-horizontal"
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="auto" id="auto" />
                            <Label htmlFor="auto">Auto Grouping</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="groups" id="groups" />
                            <Label htmlFor="groups">Feature Groups</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="files" id="files" />
                            <Label htmlFor="files">Alignment File</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Auto Grouping Section */}
                {inputType === "auto" && (
                  <div className="space-y-4">
                  {/* Metadata Selection */}
                  <div className="flex flex-wrap gap-4">
                    <FormField
                      control={form.control}
                      name="metadata_group"
                      render={({ field }) => (
                        <FormItem className="min-w-48">
                          <FormLabel className="service-card-label">Metadata</FormLabel>
                          <FormControl>
                            <Select
                              items={METADATA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                              value={field.value}
                              onValueChange={(value) => {
                                if (value == null) return;
                                field.onChange(value);
                                // Reset year ranges when metadata changes
                                if (value !== "collection_year") {
                                  setYearRangesInput("");
                                  form.setValue("year_ranges", "");
                                  setYearRangesValidation(null);
                                }
                              }}
                            >
                              <SelectTrigger className="service-card-select-trigger">
                                <SelectValue placeholder="Select metadata" />
                              </SelectTrigger>
                              <SelectContent
                                alignItemWithTrigger={true}
                                side="bottom"
                                sideOffset={4}
                              >
                                <SelectGroup>
                                  {METADATA_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectGroup>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Year Ranges (only for collection_year) */}
                    {showYearRanges && (
                      <div className="flex-1 min-w-64">
                        <Label className="service-card-label">Year Ranges</Label>
                        <Input
                          value={yearRangesInput}
                          onChange={(e) => handleYearRangesChange(e.target.value)}
                          placeholder="1998,1999-2005,2006"
                          className="service-card-input"
                        />
                        {yearRangesValidation && (
                          <p
                            className={`text-xs mt-1 ${
                              yearRangesValidation.valid
                                ? "text-muted-foreground"
                                : "text-destructive"
                            }`}
                          >
                            {yearRangesValidation.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feature Group Selector */}
                  <div className="space-y-2">
                    <Label className="service-card-label">Select Feature Group</Label>
                    <div className="flex gap-2">
                      <WorkspaceObjectSelector
                        types={["feature_group"]}
                        placeholder="Select feature group"
                        onSelectedObjectChange={(object: WorkspaceObject | null) => {
                          setSelectedAutoFeatureGroupObject(object);
                        }}
                        value={selectedAutoFeatureGroupObject?.path}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleAddAutoFeatureGroup}
                        disabled={!selectedAutoFeatureGroupObject || isLoadingAutoGroup}
                      >
                        {isLoadingAutoGroup ? (
                          <Spinner className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Alphabet Selection */}
                  <FormField
                    control={form.control}
                    name="auto_alphabet"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="service-radio-group-horizontal"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="na" id="auto_dna" />
                              <Label htmlFor="auto_dna">DNA</Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="aa" id="auto_protein" />
                              <Label htmlFor="auto_protein">Protein</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Group Names ComboBox and Change Group Button */}
                  <div className="space-y-2">
                    <Label className="service-card-label">Group Names</Label>
                    <div className="flex gap-2">
                      <Select
                        items={groupNames.map((name) => ({ value: name, label: name }))}
                        value={selectedGroupName}
                        onValueChange={(value) => setSelectedGroupName(value ?? "")}
                      >
                        <SelectTrigger className="flex-1 service-card-select-trigger">
                          <SelectValue placeholder="Select or enter group name" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {groupNames.map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={handleChangeGroup}
                        disabled={selectedGridRows.size === 0 || !selectedGroupName}
                      >
                        Change group
                      </Button>
                    </div>
                  </div>

                  {/* Groups Grid */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="service-card-label">Groups Grid</Label>
                      <span
                        className={`text-sm ${
                          uniqueGroupCount >= MIN_GROUPS && uniqueGroupCount <= MAX_GROUPS
                            ? "text-muted-foreground"
                            : "text-destructive"
                        }`}
                      >
                        {autoGroups.length > 0 &&
                          `Max groups ${MAX_GROUPS}. Current ${uniqueGroupCount} group(s).`}
                      </span>
                    </div>

                    <div className="overflow-hidden rounded-md border">
                      <Table className="service-table">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">
                              <Checkbox
                                id="select-all-meta-cats"
                                name="select-all-meta-cats"
                                checked={
                                  selectedGridRows.size === autoGroups.length &&
                                  autoGroups.length > 0
                                }
                                onCheckedChange={handleSelectAllRows}
                              />
                            </TableHead>
                            <TableHead>Patric ID</TableHead>
                            <TableHead>Strain</TableHead>
                            <TableHead>Metadata</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Genome ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {autoGroups.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="text-muted-foreground py-8 text-center"
                              >
                                No features added. Select a feature group and click + to
                                add.
                              </TableCell>
                            </TableRow>
                          ) : (
                            autoGroups.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <Checkbox
                                    id={`row-${item.id}-checkbox`}
                                    name={`row-${item.id}-checkbox`}
                                    checked={selectedGridRows.has(item.id)}
                                    onCheckedChange={() => handleRowSelect(item.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {getMetaCatsDisplayName(item.patric_id, 24)}
                                </TableCell>
                                <TableCell>{item.strain || "-"}</TableCell>
                                <TableCell>{item.metadata || "-"}</TableCell>
                                <TableCell>{item.group || "-"}</TableCell>
                                <TableCell className="font-mono text-xs">
                                  {item.genome_id}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-xs">
                        {autoGroups.length} item(s), {selectedGridRows.size} selected
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteSelectedRows}
                        disabled={selectedGridRows.size === 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Rows
                      </Button>
                    </div>

                    <FormField
                      control={form.control}
                      name="auto_groups"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Feature Groups Section */}
              {inputType === "groups" && (
                <div className="mt-4 space-y-4">
                  {/* Feature Group Selector */}
                  <div className="space-y-2">
                    <Label className="service-card-label">Select Feature Group</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <WorkspaceObjectSelector
                          types={["feature_group"]}
                          placeholder="Select feature group"
                          onSelectedObjectChange={(object: WorkspaceObject | null) => {
                            setSelectedFeatureGroupObject(object);
                          }}
                          value={selectedFeatureGroupObject?.path}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleAddFeatureGroup}
                        disabled={!selectedFeatureGroupObject}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Alphabet Selection */}
                  <FormField
                    control={form.control}
                    name="group_alphabet"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            value={field.value}
                            onValueChange={field.onChange}
                            className="service-radio-group-horizontal"
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="na" id="group_dna" />
                              <Label htmlFor="group_dna">DNA</Label>
                            </div>
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value="aa" id="group_protein" />
                              <Label htmlFor="group_protein">Protein</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Selected Feature Groups Table */}
                  <div className="space-y-2">
                    <Label className="service-card-label">
                      Selected Feature Groups ({featureGroups.length}/{MAX_GROUPS})
                    </Label>
                    <SelectedItemsTable
                      title=""
                      items={featureGroups.map((path) => ({
                        id: path,
                        name: path.split("/").pop() || path,
                        type: "file",
                      }))}
                      onRemove={handleRemoveFeatureGroup}
                      className="max-h-64 overflow-y-auto"
                    />
                    {featureGroups.length < MIN_GROUPS && (
                      <Alert variant="default">
                        <AlertDescription className="text-sm">
                          At least {MIN_GROUPS} feature groups are required.
                        </AlertDescription>
                      </Alert>
                    )}

                    <FormField
                      control={form.control}
                      name="groups"
                      render={() => (
                        <FormItem>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Alignment File Section */}
              {inputType === "files" && (
                <div className="mt-4 space-y-4">
                  {/* Alignment File Selector */}
                  <FormField
                    control={form.control}
                    name="alignment_file"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label">
                          Alignment File
                        </FormLabel>
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={["aligned_protein_fasta", "aligned_dna_fasta"]}
                            placeholder="Select alignment file"
                            onSelectedObjectChange={(object: WorkspaceObject | null) => {
                              if (object?.path) {
                                field.onChange(object.path);
                                // Store alignment type for alphabet detection
                                const type = object.type || "";
                                form.setValue("alignment_type", type);
                              } else {
                                field.onChange("");
                                form.setValue("alignment_type", "");
                              }
                              setSelectedAlignmentFileObject(object);
                            }}
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Group File Selector */}
                  <FormField
                    control={form.control}
                    name="group_file"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="service-card-label">Group File</FormLabel>
                        <FormControl>
                          <WorkspaceObjectSelector
                            types={["tsv"]}
                            placeholder="Select group file (TSV)"
                            onSelectedObjectChange={(object: WorkspaceObject | null) => {
                              if (object?.path) {
                                field.onChange(object.path);
                              } else {
                                field.onChange("");
                              }
                              setSelectedGroupFileObject(object);
                            }}
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
              </div>
            </CardContent>
          </Card>

          {/* Form Controls */}
          <div className="service-form-controls">
            <Button type="button" variant="outline" onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isValid || !isOutputNameValid}
            >
              {isSubmitting ? <Spinner /> : null}
              Submit
            </Button>
          </div>
        </form>
      </Form>

      {/* Job Params Dialog */}
      <JobParamsDialog
        open={showParamsDialog}
        onOpenChange={setShowParamsDialog}
        params={currentParams}
        serviceName={serviceName}
      />
    </section>
  );
}
