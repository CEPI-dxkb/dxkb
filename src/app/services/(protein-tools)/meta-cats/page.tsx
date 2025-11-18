"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CiCircleInfo } from "react-icons/ci";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ServiceHeader } from "@/components/services/service-header";
import OutputFolder from "@/components/services/output-folder";
import { handleFormSubmit } from "@/lib/service-utils";
import {
  metaCATSInfo,
  metaCATSParameters,
  metaCATSInput,
} from "@/lib/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import SelectedItemsTable from "@/components/services/selected-items-table";

export default function MetaCATSPage() {
  const [groupingType, setGroupingType] = useState("auto-grouping");
  const [featureGroupType, setFeatureGroupType] = useState("protein");
  const [featureGroupInput, setFeatureGroupInput] = useState("");
  const [tableData, setTableData] = useState<
    Array<{
      id: string;
      genbankAccession: string;
      strain: string;
      metadata: string;
      group: string;
      srcId: string;
      genomeId: string;
    }>
  >([]);
  // const [_selectedRows, setSelectedRows] = useState<string[]>([]);
  const [selectedFeatureGroups, setSelectedFeatureGroups] = useState<
    Array<{
      id: string;
      name: string;
    }>
  >([]);
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  const [_selectedAutoGroupingFiles, setSelectedAutoGroupingFiles] = useState<
    string[]
  >([]);
  const [autoGroupingFeatureGroup, setAutoGroupingFeatureGroup] = useState("");
  const [autoGroupingSelectedRows, setAutoGroupingSelectedRows] = useState<
    string[]
  >([]);
  const [alignmentFileInput, setAlignmentFileInput] = useState("");
  const [groupFileInput, setGroupFileInput] = useState("");

  const handleAddFeatureGroupFeature = () => {
    if (!featureGroupInput.trim()) return;

    const newGroup = {
      id: crypto.randomUUID(),
      name: featureGroupInput,
    };

    setSelectedFeatureGroups((prev) => [...prev, newGroup]);
    setFeatureGroupInput("");
  };

  const handleAddAutoGroupingFeatureGroup = () => {
    if (!autoGroupingFeatureGroup.trim()) return;

    const newItem = {
      id: crypto.randomUUID(),
      genbankAccession: autoGroupingFeatureGroup,
      strain: "N/A",
      metadata: "N/A",
      group: "Default Group",
      srcId: "N/A",
      genomeId: "N/A",
    };

    setTableData((prev) => [...prev, newItem]);
    setSelectedAutoGroupingFiles((prev) => [...prev, autoGroupingFeatureGroup]);
    setAutoGroupingFeatureGroup("");
  };

  const handleAutoGroupingRowSelect = (id: string) => {
    setAutoGroupingSelectedRows((prev) => {
      if (prev.includes(id)) {
        return prev.filter((rowId) => rowId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleAutoGroupingDeleteRows = () => {
    if (autoGroupingSelectedRows.length === 0) return;
    setTableData((prev) =>
      prev.filter((item) => !autoGroupingSelectedRows.includes(item.id)),
    );
    setSelectedAutoGroupingFiles((prev) =>
      prev.filter(
        (_, index) => !autoGroupingSelectedRows.includes(tableData[index].id),
      ),
    );
    setAutoGroupingSelectedRows([]);
  };

  const handleAutoGroupingSelectAll = (checked: boolean) => {
    if (checked) {
      setAutoGroupingSelectedRows(tableData.map((item) => item.id));
    } else {
      setAutoGroupingSelectedRows([]);
    }
  };

  return (
    <section>
      <ServiceHeader
        title="Metadata-driven Comparative Analysis Tool (Meta-CATS)"
        description="The Meta-CATS tool looks for positions that significantly differ between user-defined groups of sequences.
          However, biological biases due to correlation, codon biases, and differences in genotype, geography, time of isolation,
          or others may affect the robustness of the underlying statistical assumptions."
        infoPopupTitle={metaCATSInfo.title}
        infoPopupDescription={metaCATSInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      {/* Main Content */}
      <form onSubmit={handleFormSubmit} className="service-form-section">
        {/* Parameters Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
              <DialogInfoPopup
                title={metaCATSParameters.title}
                description={metaCATSParameters.description}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-4">
              <div>
                <Label className="service-card-label">P-Value</Label>
                <Input
                  type="number"
                  defaultValue="0.05"
                  step="0.01"
                  min="0"
                  max="1"
                  className="service-card-input"
                />
              </div>

              <div className="service-card-row">
                <div className="w-full">
                  <OutputFolder onChange={setOutputFolder} />
                </div>
                <div className="w-full">
                  <OutputFolder variant="name" onChange={setOutputName} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Input Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Input
              <DialogInfoPopup
                title={metaCATSInput.title}
                description={metaCATSInput.description}
                sections={metaCATSInput.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <RadioGroup
              defaultValue="auto"
              className="service-radio-group"
              value={groupingType}
              onValueChange={setGroupingType}
            >
              <div className="service-radio-group-item">
                <RadioGroupItem value="auto-grouping" id="auto-grouping" />
                <Label htmlFor="auto-grouping">Auto Grouping</Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="feature-groups" id="feature-groups" />
                <Label htmlFor="feature-groups">Feature Groups</Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="alignment-file" id="alignment-file" />
                <Label htmlFor="alignment-file">Alignment File</Label>
              </div>
            </RadioGroup>

            {groupingType === "auto-grouping" && (
              <>
                <div>
                  <Label className="service-card-label">Metadata</Label>

                  <Select defaultValue="host-name">
                    <SelectTrigger className="service-card-select-trigger !w-fit">
                      <SelectValue placeholder="Select metadata" />
                    </SelectTrigger>
                    <SelectContent className="service-card-select-content">
                      <SelectItem value="accession">Accession</SelectItem>
                      <SelectItem value="collection-date">
                        Collection Date
                      </SelectItem>
                      <SelectItem value="collection-year">
                        Collection Year
                      </SelectItem>
                      <SelectItem value="genome-group">Genome Group</SelectItem>
                      <SelectItem value="genome-id">Genome ID</SelectItem>
                      <SelectItem value="genome-length">
                        Genome Length
                      </SelectItem>
                      <SelectItem value="genome-name">Genome Name</SelectItem>
                      <SelectItem value="genus">Genus</SelectItem>
                      <SelectItem value="geographic-group">
                        Geographic Group
                      </SelectItem>
                      <SelectItem value="geographic-location">
                        Geographic Location
                      </SelectItem>
                      <SelectItem value="h1-clade-gobal">
                        H1 Clade Gobal
                      </SelectItem>
                      <SelectItem value="h1-clade-us">H1 Clade US</SelectItem>
                      <SelectItem value="h3-clade">H3 Clade</SelectItem>
                      <SelectItem value="h5-clade">H5 Clade</SelectItem>
                      <SelectItem value="host-group">Host Group</SelectItem>
                      <SelectItem value="host-common-name">
                        Host Common Name
                      </SelectItem>
                      <SelectItem value="host-name">Host Name</SelectItem>
                      <SelectItem value="isolation-country">
                        Isolation Country
                      </SelectItem>
                      <SelectItem value="lineage">Lineage</SelectItem>
                      <SelectItem value="species">Species</SelectItem>
                      <SelectItem value="strain">Strain</SelectItem>
                      <SelectItem value="subtype">Subtype</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4">
                  <SearchWorkspaceInput
                    title="Select Feature Group"
                    placeholder="Select DNA or Protein Feature Group"
                    onChange={setAutoGroupingFeatureGroup}
                    onAdd={handleAddAutoGroupingFeatureGroup}
                    variant="add"
                    value={autoGroupingFeatureGroup}
                  />

                  <RadioGroup
                    defaultValue="dna"
                    className="service-radio-group"
                    value={featureGroupType}
                    onValueChange={setFeatureGroupType}
                  >
                    <div className="service-radio-group-item">
                      <RadioGroupItem value="dna" id="dna" />
                      <Label htmlFor="dna">DNA</Label>
                    </div>
                    <div className="service-radio-group-item">
                      <RadioGroupItem value="protein" id="protein" />
                      <Label htmlFor="protein">Protein</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="service-card-label">Group Names</Label>
                  <div className="flex gap-2">
                    <Select defaultValue="default">
                      <SelectTrigger className="flex-1 service-card-select-trigger">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent className="service-card-select-content">
                        <SelectItem value="default">Default Group</SelectItem>
                        <SelectItem value="group1">Group 1</SelectItem>
                        <SelectItem value="group2">Group 2</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button>Change group</Button>
                  </div>
                </div>

                <div>
                  <Label className="service-card-label">Groups Grid</Label>
                  <div className="overflow-hidden rounded-md border">
                    <Table className="service-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={
                                autoGroupingSelectedRows.length ===
                                  tableData.length && tableData.length > 0
                              }
                              onCheckedChange={handleAutoGroupingSelectAll}
                            />
                          </TableHead>
                          <TableHead>Genbank Accession</TableHead>
                          <TableHead>Strain</TableHead>
                          <TableHead>Metadata</TableHead>
                          <TableHead>Group</TableHead>
                          <TableHead>
                            SRC ID
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <CiCircleInfo
                                    size={14}
                                    className="text-muted-foreground ml-1 inline"
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    Source ID information
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                          <TableHead>
                            Genome ID
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <CiCircleInfo
                                    size={14}
                                    className="text-muted-foreground ml-1 inline"
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    Genome ID information
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tableData.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="text-muted-foreground py-8 text-center"
                            >
                              No feature groups selected.
                            </TableCell>
                          </TableRow>
                        ) : (
                          tableData.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Checkbox
                                  checked={autoGroupingSelectedRows.includes(
                                    item.id,
                                  )}
                                  onCheckedChange={() =>
                                    handleAutoGroupingRowSelect(item.id)
                                  }
                                />
                              </TableCell>
                              <TableCell>{item.genbankAccession}</TableCell>
                              <TableCell>{item.strain}</TableCell>
                              <TableCell>{item.metadata}</TableCell>
                              <TableCell>{item.group}</TableCell>
                              <TableCell>{item.srcId}</TableCell>
                              <TableCell>{item.genomeId}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="mt-2 flex justify-between gap-2 align-top">
                    <div className="text-muted-foreground text-xs">
                      {tableData.length} - {tableData.length} of{" "}
                      {tableData.length} results
                    </div>

                    <Button
                      variant="outline"
                      onClick={handleAutoGroupingDeleteRows}
                      disabled={autoGroupingSelectedRows.length === 0}
                    >
                      Delete Rows
                    </Button>
                  </div>
                </div>
              </>
            )}

            {groupingType === "feature-groups" && (
              <>
                <div className="space-y-4">
                  <SearchWorkspaceInput
                    title="Select Feature Group"
                    placeholder="Select DNA or Protein Feature Group"
                    onChange={setFeatureGroupInput}
                    onAdd={handleAddFeatureGroupFeature}
                    variant="add"
                    value={featureGroupInput}
                  />

                  <RadioGroup
                    defaultValue="dna"
                    className="service-radio-group"
                    value={featureGroupType}
                    onValueChange={setFeatureGroupType}
                  >
                    <div className="service-radio-group-item">
                      <RadioGroupItem value="dna" id="dna" />
                      <Label htmlFor="dna">DNA</Label>
                    </div>
                    <div className="service-radio-group-item">
                      <RadioGroupItem value="protein" id="protein" />
                      <Label htmlFor="protein">Protein</Label>
                    </div>
                  </RadioGroup>
                </div>

                <SelectedItemsTable
                  title="Selected Files/Feature Group"
                  items={selectedFeatureGroups.map(
                    (file: { id: string; name: string }) => ({
                      id: file.id,
                      name: file.name,
                      type: "file",
                    }),
                  )}
                  onRemove={(id: string) => {
                    setSelectedFeatureGroups(
                      (prev: { id: string; name: string }[]) =>
                        prev.filter(
                          (file: { id: string; name: string }) =>
                            file.id !== id,
                        ),
                    );
                  }}
                  className="max-h-84 overflow-y-auto"
                />
              </>
            )}

            {groupingType === "alignment-file" && (
              <div className="space-y-4">
                <SearchWorkspaceInput
                  title="Select Alignment File"
                  placeholder="Alignment File..."
                  onChange={setAlignmentFileInput}
                  value={alignmentFileInput}
                />

                <SearchWorkspaceInput
                  title="Select Group File"
                  placeholder="Group File..."
                  onChange={setGroupFileInput}
                  value={groupFileInput}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </form>

      {/* Form Controls */}
      <div className="service-form-controls">
        <Button variant="outline">Reset</Button>
        <Button>Submit</Button>
      </div>
    </section>
  );
}
