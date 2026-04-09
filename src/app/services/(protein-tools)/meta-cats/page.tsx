"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { useDefaultOutputPath } from "@/hooks/services/use-default-output-path";
import { normalizeToArray } from "@/lib/rerun-utility";
import { useForm, useStore } from "@tanstack/react-form";
import { FieldItem, FieldErrors } from "@/components/ui/tanstack-form";
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
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { useServiceFormSubmission } from "@/hooks/services/use-service-form-submission";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import SelectedItemsTable from "@/components/services/selected-items-table";
import {
  metaCatsFormSchema,
  defaultMetaCatsFormValues,
  metadataOptions,
  maxGroups,
  minGroups,
  type MetaCatsFormData,
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
import { fetchFeaturesFromGroup } from "@/lib/services/feature";
import { fetchGenomesByIds, type GenomeSummary } from "@/lib/services/genome";

export default function MetaCATSPage() {
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
  const [_selectedAlignmentFileObject, setSelectedAlignmentFileObject] =
    useState<WorkspaceObject | null>(null);
  const [_selectedGroupFileObject, setSelectedGroupFileObject] =
    useState<WorkspaceObject | null>(null);

  // General state
  const [isOutputNameValid, setIsOutputNameValid] = useState(true);

  const form = useForm({
    defaultValues: defaultMetaCatsFormValues as MetaCatsFormData,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validators: { onChange: metaCatsFormSchema as any },
    onSubmit: async ({ value }) => {
      // handleSubmit captured by closure — initialized by useServiceFormSubmission below
      await handleSubmit(value as MetaCatsFormData);
    },
  });

  // Handle reset
  const handleReset = useCallback(() => {
    form.reset(defaultMetaCatsFormValues);
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
    isSubmitting,
  } = useServiceFormSubmission<MetaCatsFormData>({
    serviceName: "MetaCATS",
    transformParams: transformMetaCatsParams,
    onSuccess: handleReset,
  });

  const inputType = useStore(form.store, (s) => s.values.input_type);
  const metadataGroup = useStore(form.store, (s) => s.values.metadata_group);
  const rawAutoGroups = useStore(form.store, (s) => s.values.auto_groups);
  const autoGroups = useMemo(() => rawAutoGroups || [], [rawAutoGroups]);
  const rawFeatureGroups = useStore(form.store, (s) => s.values.groups);
  const featureGroups = useMemo(() => rawFeatureGroups || [], [rawFeatureGroups]);
  const outputPath = useStore(form.store, (s) => s.values.output_path);
  const canSubmit = useStore(form.store, (s) => s.canSubmit);

  // Rerun pre-fill
  const { rerunData, markApplied } = useRerunForm<Record<string, unknown>>();
  useDefaultOutputPath(form, rerunData);

  useEffect(() => {
    if (!rerunData || !markApplied()) return;

    // p_value
    if (typeof rerunData.p_value === "number") {
      form.setFieldValue("p_value", rerunData.p_value);
    }

    // output_path / output_file
    if (typeof rerunData.output_path === "string") {
      form.setFieldValue("output_path", rerunData.output_path);
    }
    if (typeof rerunData.output_file === "string") {
      form.setFieldValue("output_file", rerunData.output_file);
    }

    // input_type
    if (typeof rerunData.input_type === "string") {
      form.setFieldValue("input_type", rerunData.input_type as MetaCatsFormData["input_type"]);
    }

    // Auto grouping fields
    if (typeof rerunData.metadata_group === "string") {
      form.setFieldValue("metadata_group", rerunData.metadata_group);
    }
    if (typeof rerunData.year_ranges === "string" && rerunData.year_ranges.trim() !== "") {
      form.setFieldValue("year_ranges", rerunData.year_ranges);
      setYearRangesInput(rerunData.year_ranges);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const autoGroupsRaw = normalizeToArray<any>(rerunData.auto_groups);
    if (autoGroupsRaw.length > 0) {
      // API format uses { id, metadata, grp, g_id } — map back to internal form format
      const mappedAutoGroups: MetaCatsFormData["auto_groups"] = autoGroupsRaw.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => ({
          id: crypto.randomUUID(),
          patric_id: item.patric_id ?? item.id ?? "",
          metadata: item.metadata ?? "",
          group: item.group ?? item.grp ?? "",
          genome_id: item.genome_id ?? item.g_id ?? "",
          strain: item.strain ?? "",
          genbank_accessions: item.genbank_accessions ?? "",
        })
      );
      form.setFieldValue("auto_groups", mappedAutoGroups);
      const uniqueGroupNames = Array.from(
        new Set(mappedAutoGroups.map((item) => item.group).filter(Boolean))
      ) as string[];
      setGroupNames(uniqueGroupNames);
    }
    if (typeof rerunData.auto_alphabet === "string") {
      form.setFieldValue("auto_alphabet", rerunData.auto_alphabet as MetaCatsFormData["auto_alphabet"]);
    }

    // Feature groups fields
    const groupsRaw = normalizeToArray<string>(rerunData.groups);
    if (groupsRaw.length > 0) {
      form.setFieldValue("groups", groupsRaw);
    }
    if (typeof rerunData.group_alphabet === "string") {
      form.setFieldValue("group_alphabet", rerunData.group_alphabet as MetaCatsFormData["group_alphabet"]);
    }

    // Alignment file fields
    if (typeof rerunData.alignment_file === "string" && rerunData.alignment_file.trim() !== "") {
      form.setFieldValue("alignment_file", rerunData.alignment_file);
    }
    if (typeof rerunData.alignment_type === "string") {
      form.setFieldValue("alignment_type", rerunData.alignment_type);
    }
    if (typeof rerunData.group_file === "string" && rerunData.group_file.trim() !== "") {
      form.setFieldValue("group_file", rerunData.group_file);
    }
  }, [rerunData, markApplied, form]);

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
    form.setFieldValue("year_ranges", value);
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
    const currentMetadataGroup = form.state.values.metadata_group || "host_name";
    const yearRanges = form.state.values.year_ranges || "";

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

      const currentAutoGroups = form.state.values.auto_groups || [];

      const { newAutoGroups, nextGroupNames } = buildMetaCatsAutoGroupsFromGenomes({
        genomes: genomes as unknown as (GenomeSummary & Record<string, unknown>)[],
        genomeIdMap,
        metadataGroup: currentMetadataGroup,
        yearRanges,
        existingAutoGroups: currentAutoGroups,
        existingGroupNames: groupNames,
      });

      // Update form and state
      form.setFieldValue("auto_groups", [...currentAutoGroups, ...newAutoGroups]);
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
  }, [selectedAutoFeatureGroupObject, form, groupNames]);

  // Handle deleting selected rows from grid
  const handleDeleteSelectedRows = useCallback(() => {
    if (selectedGridRows.size === 0) return;

    const currentAutoGroups = form.state.values.auto_groups || [];
    const updatedAutoGroups = removeAutoGroupsByRowIds(currentAutoGroups, selectedGridRows);
    form.setFieldValue("auto_groups", updatedAutoGroups);

    // Update group names
    const remainingGroupNames = getUniqueGroupNames(updatedAutoGroups);
    setGroupNames(remainingGroupNames);
    setSelectedGridRows(new Set());

    toast.success(`Deleted ${selectedGridRows.size} row(s)`, { closeButton: true });
  }, [selectedGridRows, form]);

  // Handle changing group for selected rows
  const handleChangeGroup = useCallback(() => {
    if (!selectedGroupName || selectedGridRows.size === 0) {
      toast.error("Select rows and enter a group name", { closeButton: true });
      return;
    }

    const currentAutoGroups = form.state.values.auto_groups || [];
    const updatedAutoGroups = updateAutoGroupsGroupByRowIds(
      currentAutoGroups,
      selectedGridRows,
      selectedGroupName
    );

    form.setFieldValue("auto_groups", updatedAutoGroups);

    // Update group names
    const newGroupNames = new Set(groupNames);
    newGroupNames.add(selectedGroupName);
    setGroupNames(Array.from(newGroupNames));

    toast.success(`Changed group for ${selectedGridRows.size} row(s)`, {
      closeButton: true,
    });
  }, [selectedGroupName, selectedGridRows, form, groupNames]);

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
    const currentFeatureGroups = form.state.values.groups || [];

    // Check for duplicates
    if (currentFeatureGroups.includes(path)) {
      toast.error("Feature group already added", {
        description: "This feature group is already in the list.",
        closeButton: true,
      });
      return;
    }

    // Check max limit
    if (currentFeatureGroups.length >= maxGroups) {
      toast.error("Maximum groups reached", {
        description: `Maximum of ${maxGroups} feature groups allowed.`,
        closeButton: true,
      });
      return;
    }

    form.setFieldValue("groups", [...currentFeatureGroups, path]);
    setSelectedFeatureGroupObject(null);
  }, [selectedFeatureGroupObject, form]);

  // Handle removing feature group
  const handleRemoveFeatureGroup = useCallback(
    (path: string) => {
      const currentFeatureGroups = form.state.values.groups || [];
      const updatedGroups = currentFeatureGroups.filter((g) => g !== path);
      form.setFieldValue("groups", updatedGroups);
    },
    [form]
  );

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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit();
        }}
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
              <form.Field name="p_value">
                {(field) => (
                  <FieldItem>
                    <Label className="service-card-label">P-Value</Label>
                    <NumberInput
                      name={field.name}
                      value={field.state.value}
                      min={0}
                      max={1}
                      stepper={0.01}
                      decimalScale={2}
                      onValueChange={(value) => {
                        if (value !== undefined) field.handleChange(value);
                      }}
                      className="relative [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none service-card-input max-w-32"
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <div className="flex flex-col space-y-4">
                <form.Field name="output_path">
                  {(field) => (
                    <FieldItem>
                      <OutputFolder
                        required={true}
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
                        required={true}
                        value={field.state.value}
                        onChange={field.handleChange}
                        outputFolderPath={outputPath}
                        onValidationChange={setIsOutputNameValid}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
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
              <form.Field name="input_type">
                {(field) => (
                  <FieldItem>
                    <RadioGroup
                      value={field.state.value}
                      onValueChange={(value) => value != null && field.handleChange(value as MetaCatsFormData["input_type"])}
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
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              {/* Auto Grouping Section */}
              {inputType === "auto" && (
                <div className="space-y-4">
                {/* Metadata Selection */}
                <div className="flex flex-wrap gap-4">
                  <form.Field name="metadata_group">
                    {(field) => (
                      <FieldItem className="min-w-48">
                        <Label className="service-card-label">Metadata</Label>
                        <Select
                          items={metadataOptions.map((o) => ({ value: o.value, label: o.label }))}
                          value={field.state.value}
                          onValueChange={(value) => {
                            if (value == null) return;
                            field.handleChange(value);
                            // Reset year ranges when metadata changes
                            if (value !== "collection_year") {
                              setYearRangesInput("");
                              form.setFieldValue("year_ranges", "");
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
                              {metadataOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>

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
                <form.Field name="auto_alphabet">
                  {(field) => (
                    <FieldItem>
                      <RadioGroup
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value as "na" | "aa")}
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
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

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
                        uniqueGroupCount >= minGroups && uniqueGroupCount <= maxGroups
                          ? "text-muted-foreground"
                          : "text-destructive"
                      }`}
                    >
                      {autoGroups.length > 0 &&
                        `Max groups ${maxGroups}. Current ${uniqueGroupCount} group(s).`}
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

                  <form.Field name="auto_groups">
                    {(field) => (
                      <FieldItem>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
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
                <form.Field name="group_alphabet">
                  {(field) => (
                    <FieldItem>
                      <RadioGroup
                        value={field.state.value}
                        onValueChange={(value) => value != null && field.handleChange(value as "na" | "aa")}
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
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* Selected Feature Groups Table */}
                <div className="space-y-2">
                  <Label className="service-card-label">
                    Selected Feature Groups ({featureGroups.length}/{maxGroups})
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
                  {featureGroups.length < minGroups && (
                    <Alert variant="default">
                      <AlertDescription className="text-sm">
                        At least {minGroups} feature groups are required.
                      </AlertDescription>
                    </Alert>
                  )}

                  <form.Field name="groups">
                    {(field) => (
                      <FieldItem>
                        <FieldErrors field={field} />
                      </FieldItem>
                    )}
                  </form.Field>
                </div>
              </div>
            )}

            {/* Alignment File Section */}
            {inputType === "files" && (
              <div className="mt-4 space-y-4">
                {/* Alignment File Selector */}
                <form.Field name="alignment_file">
                  {(field) => (
                    <FieldItem>
                      <Label className="service-card-label">
                        Alignment File
                      </Label>
                      <WorkspaceObjectSelector
                        types={["aligned_protein_fasta", "aligned_dna_fasta"]}
                        placeholder="Select alignment file"
                        onSelectedObjectChange={(object: WorkspaceObject | null) => {
                          if (object?.path) {
                            field.handleChange(object.path);
                            // Store alignment type for alphabet detection
                            const type = object.type || "";
                            form.setFieldValue("alignment_type", type);
                          } else {
                            field.handleChange("");
                            form.setFieldValue("alignment_type", "");
                          }
                          setSelectedAlignmentFileObject(object);
                        }}
                        value={field.state.value}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>

                {/* Group File Selector */}
                <form.Field name="group_file">
                  {(field) => (
                    <FieldItem>
                      <Label className="service-card-label">Group File</Label>
                      <WorkspaceObjectSelector
                        types={["tsv"]}
                        placeholder="Select group file (TSV)"
                        onSelectedObjectChange={(object: WorkspaceObject | null) => {
                          if (object?.path) {
                            field.handleChange(object.path);
                          } else {
                            field.handleChange("");
                          }
                          setSelectedGroupFileObject(object);
                        }}
                        value={field.state.value}
                      />
                      <FieldErrors field={field} />
                    </FieldItem>
                  )}
                </form.Field>
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
            disabled={isSubmitting || !canSubmit || !isOutputNameValid}
          >
            {isSubmitting ? <Spinner /> : null}
            Submit
          </Button>
        </div>
      </form>

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
