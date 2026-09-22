"use client";

import { useState } from "react";
import { useServiceRuntime } from "@/hooks/services/use-service-runtime";
import { normalizeToArray } from "@/lib/rerun-utility";
import { useForm } from "@tanstack/react-form";
import { useSelector } from "@tanstack/react-store";
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
} from "@/lib/services/info/meta-cats";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { ServiceOutputFields } from "@/components/services/service-output-fields";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { WorkspaceObject } from "@/lib/services/workspace/types";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
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
  getMetaCatsDisplayName,
  countUniqueGroups,
  getUniqueGroupNames,
  validateYearRanges,
  createGenomeIdMapFromFeatures,
  buildMetaCatsAutoGroupsFromGenomes,
  removeAutoGroupsByRowIds,
  updateAutoGroupsGroupByRowIds,
} from "@/lib/forms/(protein-tools)/meta-cats/meta-cats-form-utils";
import { metaCatsService } from "@/lib/forms/(protein-tools)/meta-cats/meta-cats-service";
import { fetchFeaturesFromGroup } from "@/lib/services/feature";
import { fetchGenomesByIds, type GenomeSummary } from "@/lib/services/genome";
import { MetaCatsInputSection } from "./meta-cats-input-sections";

const emptyAutoGroups: NonNullable<MetaCatsFormData["auto_groups"]> = [];
const emptyFeatureGroups: string[] = [];

function useMetaCATSPage() {
  // State for auto grouping
  const [selectedAutoFeatureGroupObject, setSelectedAutoFeatureGroupObject] =
    useState<WorkspaceObject | null>(null);
  const [isLoadingAutoGroup, setIsLoadingAutoGroup] = useState(false);
  const [selectedGridRows, setSelectedGridRows] = useState<Set<string>>(
    new Set(),
  );
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
    defaultValues: defaultMetaCatsFormValues,
    validators: { onChange: metaCatsFormSchema },
    onSubmit: async ({ value }) => {
      await runtime.submitFormData(value);
    },
  });

  function handleReset() {
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
  }

  const inputType = useSelector(form.store, (s) => s.values.input_type);
  const metadataGroup = useSelector(form.store, (s) => s.values.metadata_group);
  const autoGroups = useSelector(
    form.store,
    (state) => state.values.auto_groups ?? emptyAutoGroups,
  );
  const featureGroups = useSelector(
    form.store,
    (state) => state.values.groups ?? emptyFeatureGroups,
  );
  const canSubmit = useSelector(form.store, (s) => s.canSubmit);

  const runtime = useServiceRuntime({
    definition: metaCatsService,
    form,
    onSuccess: handleReset,
    rerun: {
      onApply: (rerunData, form) => {
        if (typeof rerunData.p_value === "number") {
          form.setFieldValue("p_value", rerunData.p_value);
        }

        if (
          typeof rerunData.year_ranges === "string" &&
          rerunData.year_ranges.trim() !== ""
        ) {
          form.setFieldValue("year_ranges", rerunData.year_ranges);
          setYearRangesInput(rerunData.year_ranges);
        }

        const autoGroupsRaw = normalizeToArray<Record<string, unknown>>(
          rerunData.auto_groups,
        );
        if (autoGroupsRaw.length > 0) {
          const mappedAutoGroups: MetaCatsFormData["auto_groups"] =
            autoGroupsRaw.map((item) => ({
              id: crypto.randomUUID(),
              patric_id: (item.patric_id ?? item.id ?? "") as string,
              metadata: (item.metadata ?? "") as string,
              group: (item.group ?? item.grp ?? "") as string,
              genome_id: (item.genome_id ?? item.g_id ?? "") as string,
              strain: (item.strain ?? "") as string,
              genbank_accessions: (item.genbank_accessions ?? "") as string,
            }));
          form.setFieldValue("auto_groups", mappedAutoGroups);
          const uniqueGroupNames = Array.from(
            mappedAutoGroups.reduce((groups, item) => {
              if (item.group) groups.add(item.group);
              return groups;
            }, new Set<string>()),
          );
          setGroupNames(uniqueGroupNames);
        }

        const groupsRaw = normalizeToArray<string>(rerunData.groups);
        if (groupsRaw.length > 0) {
          form.setFieldValue("groups", groupsRaw);
        }

        if (
          typeof rerunData.alignment_file === "string" &&
          rerunData.alignment_file.trim() !== ""
        ) {
          form.setFieldValue("alignment_file", rerunData.alignment_file);
        }
        if (
          typeof rerunData.group_file === "string" &&
          rerunData.group_file.trim() !== ""
        ) {
          form.setFieldValue("group_file", rerunData.group_file);
        }
      },
    },
  });
  const { isSubmitting, jobParamsDialogProps } = runtime;

  const uniqueGroupCount = countUniqueGroups(autoGroups);
  const showYearRanges = metadataGroup === "collection_year";

  function handleYearRangesChange(value: string) {
    setYearRangesInput(value);
    const validation = validateYearRanges(value);
    setYearRangesValidation(validation);
    form.setFieldValue("year_ranges", value);
  }

  async function handleAddAutoFeatureGroup() {
    if (!selectedAutoFeatureGroupObject?.path) {
      toast.error("No feature group selected", {
        description: "Please select a feature group before adding.",
        closeButton: true,
      });
      return;
    }

    const featureGroupPath = selectedAutoFeatureGroupObject.path;
    const currentMetadataGroup =
      form.state.values.metadata_group || "host_name";
    const yearRanges = form.state.values.year_ranges || "";

    setIsLoadingAutoGroup(true);

    try {
      // Fetch features from the feature group
      const features = await fetchFeaturesFromGroup(featureGroupPath).finally(
        () => {
          setIsLoadingAutoGroup(false);
        },
      );

      if (features.length === 0) {
        toast.error("Empty feature group", {
          description: "The selected feature group has no features.",
          closeButton: true,
        });
        return;
      }

      // Get unique genome IDs from features
      const genomeIdMap = createGenomeIdMapFromFeatures(features);
      const genomeIds = Array.from(genomeIdMap.keys());

      // Fetch genome metadata
      const genomes = await fetchGenomesByIds(genomeIds);

      const currentAutoGroups = form.state.values.auto_groups || [];

      const { newAutoGroups, nextGroupNames } =
        buildMetaCatsAutoGroupsFromGenomes({
          genomes: genomes as unknown as (GenomeSummary &
            Record<string, unknown>)[],
          genomeIdMap,
          metadataGroup: currentMetadataGroup,
          yearRanges,
          existingAutoGroups: currentAutoGroups,
          existingGroupNames: groupNames,
        });

      // Update form and state
      form.setFieldValue("auto_groups", [
        ...currentAutoGroups,
        ...newAutoGroups,
      ]);
      setGroupNames(nextGroupNames);
      setSelectedAutoFeatureGroupObject(null);

      if (newAutoGroups.length > 0) {
        toast.success(`Added ${String(newAutoGroups.length)} feature(s)`, {
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
    }
  }

  function handleDeleteSelectedRows() {
    if (selectedGridRows.size === 0) return;

    const currentAutoGroups = form.state.values.auto_groups || [];
    const updatedAutoGroups = removeAutoGroupsByRowIds(
      currentAutoGroups,
      selectedGridRows,
    );
    form.setFieldValue("auto_groups", updatedAutoGroups);

    // Update group names
    const remainingGroupNames = getUniqueGroupNames(updatedAutoGroups);
    setGroupNames(remainingGroupNames);
    setSelectedGridRows(new Set());

    toast.success(`Deleted ${String(selectedGridRows.size)} row(s)`, {
      closeButton: true,
    });
  }

  function handleChangeGroup() {
    if (!selectedGroupName || selectedGridRows.size === 0) {
      toast.error("Select rows and enter a group name", { closeButton: true });
      return;
    }

    const currentAutoGroups = form.state.values.auto_groups || [];
    const updatedAutoGroups = updateAutoGroupsGroupByRowIds(
      currentAutoGroups,
      selectedGridRows,
      selectedGroupName,
    );

    form.setFieldValue("auto_groups", updatedAutoGroups);

    // Update group names
    const newGroupNames = new Set(groupNames);
    newGroupNames.add(selectedGroupName);
    setGroupNames(Array.from(newGroupNames));

    toast.success(`Changed group for ${String(selectedGridRows.size)} row(s)`, {
      closeButton: true,
    });
  }

  function handleSelectAllRows(checked: boolean) {
    setSelectedGridRows(
      checked ? new Set(autoGroups.map((item) => item.id)) : new Set(),
    );
  }

  function handleRowSelect(id: string) {
    setSelectedGridRows((previousRows) => {
      const nextRows = new Set(previousRows);
      if (nextRows.has(id)) {
        nextRows.delete(id);
      } else {
        nextRows.add(id);
      }
      return nextRows;
    });
  }

  function handleAddFeatureGroup() {
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
        description: `Maximum of ${String(maxGroups)} feature groups allowed.`,
        closeButton: true,
      });
      return;
    }

    form.setFieldValue("groups", [...currentFeatureGroups, path]);
    setSelectedFeatureGroupObject(null);
  }

  function handleRemoveFeatureGroup(path: string) {
    const currentFeatureGroups = form.state.values.groups || [];
    form.setFieldValue(
      "groups",
      currentFeatureGroups.filter((groupPath) => groupPath !== path),
    );
  }

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
          void form.handleSubmit();
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
                      aria-label="P-Value"
                      value={field.state.value}
                      min={0}
                      max={1}
                      stepper={0.01}
                      decimalScale={2}
                      onValueChange={(value) => {
                        if (value !== undefined) field.handleChange(value);
                      }}
                      className="service-card-input relative max-w-32 [appearance:textfield] rounded-r-none bg-muted [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>

              <form.Field name="output_path">
                {(outputPathField) => (
                  <form.Field name="output_file">
                    {(outputNameField) => (
                      <ServiceOutputFields
                        outputPath={{
                          value: outputPathField.state.value,
                          onChange: outputPathField.handleChange,
                          errors: <FieldErrors field={outputPathField} />,
                        }}
                        outputName={{
                          value: outputNameField.state.value,
                          onChange: outputNameField.handleChange,
                          errors: <FieldErrors field={outputNameField} />,
                        }}
                        onOutputNameValidationChange={setIsOutputNameValid}
                      />
                    )}
                  </form.Field>
                )}
              </form.Field>
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
                      onValueChange={(value) => {
                        if (value != null)
                          field.handleChange(
                            value as MetaCatsFormData["input_type"],
                          );
                      }}
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
              <MetaCatsInputSection
                active={inputType === "auto"}
                className="space-y-4"
              >
                  {/* Metadata Selection */}
                  <div className="flex flex-wrap gap-4">
                    <form.Field name="metadata_group">
                      {(field) => (
                        <FieldItem className="min-w-48">
                          <Label className="service-card-label">Metadata</Label>
                          <Select
                            items={metadataOptions.map((o) => ({
                              value: o.value,
                              label: o.label,
                            }))}
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
                            <SelectTrigger
                              className="service-card-select-trigger"
                              aria-label="Select metadata"
                            >
                              <SelectValue placeholder="Select metadata" />
                            </SelectTrigger>
                            <SelectContent
                              alignItemWithTrigger={true}
                              side="bottom"
                              sideOffset={4}
                            >
                              <SelectGroup>
                                {metadataOptions.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
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
                      <div className="min-w-64 flex-1">
                        <Label className="service-card-label">
                          Year Ranges
                        </Label>
                        <Input
                          value={yearRangesInput}
                          onChange={(e) => {
                            handleYearRangesChange(e.target.value);
                          }}
                          placeholder="1998,1999-2005,2006"
                          className="service-card-input"
                        />
                        {yearRangesValidation && (
                          <p
                            className={`mt-1 text-xs ${
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
                    <Label className="service-card-label">
                      Select Feature Group
                    </Label>
                    <div className="flex gap-2">
                      <WorkspaceObjectSelector
                        preset="featureGroup"
                        placeholder="Select feature group"
                        onSelectedObjectChange={(
                          object: WorkspaceObject | null,
                        ) => {
                          setSelectedAutoFeatureGroupObject(object);
                        }}
                        value={selectedAutoFeatureGroupObject?.path}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Add feature group"
                        onClick={() => {
                          void handleAddAutoFeatureGroup();
                        }}
                        disabled={
                          !selectedAutoFeatureGroupObject || isLoadingAutoGroup
                        }
                      >
                        {isLoadingAutoGroup ? (
                          <Spinner className="size-4" />
                        ) : (
                          <Plus className="size-4" />
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
                          onValueChange={(value) => {
                            if (value != null)
                              field.handleChange(value as "na" | "aa");
                          }}
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
                        items={groupNames.map((name) => ({
                          value: name,
                          label: name,
                        }))}
                        value={selectedGroupName}
                        onValueChange={(value) => {
                          setSelectedGroupName(value ?? "");
                        }}
                      >
                        <SelectTrigger
                          className="service-card-select-trigger flex-1"
                          aria-label="Select group name"
                        >
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
                        disabled={
                          selectedGridRows.size === 0 || !selectedGroupName
                        }
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
                          uniqueGroupCount >= minGroups &&
                          uniqueGroupCount <= maxGroups
                            ? "text-muted-foreground"
                            : "text-destructive"
                        }`}
                      >
                        {autoGroups.length > 0 &&
                          `Max groups ${String(maxGroups)}. Current ${String(uniqueGroupCount)} group(s).`}
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
                                aria-label="Select all"
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
                                className="py-8 text-center text-muted-foreground"
                              >
                                No features added. Select a feature group and
                                click + to add.
                              </TableCell>
                            </TableRow>
                          ) : (
                            autoGroups.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <Checkbox
                                    id={`row-${item.id}-checkbox`}
                                    name={`row-${item.id}-checkbox`}
                                    aria-label={`Select ${item.patric_id}`}
                                    checked={selectedGridRows.has(item.id)}
                                    onCheckedChange={() => {
                                      handleRowSelect(item.id);
                                    }}
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
                      <span className="text-xs text-muted-foreground">
                        {autoGroups.length} item(s), {selectedGridRows.size}{" "}
                        selected
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteSelectedRows}
                        disabled={selectedGridRows.size === 0}
                      >
                        <Trash2 className="mr-2 size-4" />
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
              </MetaCatsInputSection>

              {/* Feature Groups Section */}
              <MetaCatsInputSection active={inputType === "groups"}>
                  {/* Feature Group Selector */}
                  <div className="space-y-2">
                    <Label className="service-card-label">
                      Select Feature Group
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <WorkspaceObjectSelector
                          preset="featureGroup"
                          placeholder="Select feature group"
                          onSelectedObjectChange={(
                            object: WorkspaceObject | null,
                          ) => {
                            setSelectedFeatureGroupObject(object);
                          }}
                          value={selectedFeatureGroupObject?.path}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Add feature group"
                        onClick={handleAddFeatureGroup}
                        disabled={!selectedFeatureGroupObject}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Alphabet Selection */}
                  <form.Field name="group_alphabet">
                    {(field) => (
                      <FieldItem>
                        <RadioGroup
                          value={field.state.value}
                          onValueChange={(value) => {
                            if (value != null)
                              field.handleChange(value as "na" | "aa");
                          }}
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
                      Selected Feature Groups ({featureGroups.length}/
                      {maxGroups})
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
              </MetaCatsInputSection>

              {/* Alignment File Section */}
              <MetaCatsInputSection active={inputType === "files"}>
                  {/* Alignment File Selector */}
                  <form.Field name="alignment_file">
                    {(field) => (
                      <FieldItem>
                        <Label className="service-card-label">
                          Alignment File
                        </Label>
                        <WorkspaceObjectSelector
                          preset="alignedFasta"
                          placeholder="Select alignment file"
                          onSelectedObjectChange={(
                            object: WorkspaceObject | null,
                          ) => {
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
                          preset="tsv"
                          placeholder="Select group file (TSV)"
                          onSelectedObjectChange={(
                            object: WorkspaceObject | null,
                          ) => {
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
              </MetaCatsInputSection>
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

      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}

export default function MetaCATSPage() {
  return useMetaCATSPage();
}
