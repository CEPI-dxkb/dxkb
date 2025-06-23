"use client";

import { useState } from "react";
import { ServiceHeader } from "@/components/services/service-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import {
  blastServiceInfo,
  blastServiceSearchProgram,
  blastServiceQuerySource,
  blastServiceDatabaseSource,
  blastServiceDatabaseType,
} from "@/lib/service-info";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import { Checkbox } from "@/components/ui/checkbox";
import OutputFolder from "@/components/services/output-folder";
import { handleFormSubmit } from "@/lib/service-utils";

export default function BlastServicePage() {
  const [searchProgram, setSearchProgram] = useState("blastn");
  const [queryType, setQueryType] = useState("enterSequence");
  const [sequenceInput, setSequenceInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [_maxHits, setMaxHits] = useState("10");
  const [_eValueThreshold, setEValueThreshold] = useState("0.0001");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");

  const handleReset = () => {
    setSearchProgram("");
    setQueryType("enterSequence");
    setSequenceInput("");
    setShowAdvanced(false);
    setMaxHits("10");
    setEValueThreshold("0.0001");
    setOutputFolder("");
    setOutputName("");
  };

  return (
    <section>
      <ServiceHeader
        title="BLAST"
        description="The BLAST service uses BLAST (Basic Local Alignment Search Tool) to search against
          public or private genomes or other databases using DNA or protein sequence(s)."
        infoPopupTitle={blastServiceInfo.title}
        infoPopupDescription={blastServiceInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form onSubmit={handleFormSubmit} className="service-form-section">
        {/* Search Program Card */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Search Program
              <DialogInfoPopup
                title={blastServiceSearchProgram.title}
                description={blastServiceSearchProgram.description}
                sections={blastServiceSearchProgram.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <RadioGroup
              value={searchProgram}
              onValueChange={setSearchProgram}
              className="service-radio-group"
            >
              <div className="service-radio-group-item">
                <RadioGroupItem value="blastn" id="blastn" />
                <Label htmlFor="blastn" className="service-radio-group-label">
                  BLASTN (nucleotide → nucleotide database)
                </Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="blastp" id="blastp" />
                <Label htmlFor="blastp" className="service-radio-group-label">
                  BLASTP (protein → protein database)
                </Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="blastx" id="blastx" />
                <Label htmlFor="blastx" className="service-radio-group-label">
                  BLASTX (translated nucleotide → protein database)
                </Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="tblastn" id="tblastn" />
                <Label htmlFor="tblastn" className="service-radio-group-label">
                  tBLASTn (protein → translated nucleotide database)
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Query Source Card */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Query Source
              <DialogInfoPopup
                title={blastServiceQuerySource.title}
                description={blastServiceQuerySource.description}
                sections={blastServiceQuerySource.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-6">
              <RadioGroup
                value={queryType}
                onValueChange={setQueryType}
                className="service-radio-group"
              >
                <div className="service-radio-group-item">
                  <RadioGroupItem value="enterSequence" id="enterSequence" />
                  <Label htmlFor="enterSequence">
                    Enter sequence
                  </Label>
                </div>
                <div className="service-radio-group-item">
                  <RadioGroupItem value="selectFasta" id="selectFasta" />
                  <Label htmlFor="selectFasta">
                    Select FASTA file
                  </Label>
                </div>
                <div className="service-radio-group-item">
                  <RadioGroupItem value="selectFeature" id="selectFeature" />
                  {/* TODO: Add feature group selector from Workspace */}
                  <Label htmlFor="selectFeature">
                    Select feature group
                  </Label>
                </div>
              </RadioGroup>

              {queryType === "enterSequence" && (
                <div className="service-card-content-grid-item">
                  <Label
                    htmlFor="sequence-input"
                    className="service-card-label"
                  >
                    Enter a FASTA formatted sequence.
                  </Label>
                  <Textarea
                    id="sequence-input"
                    placeholder="Enter one or more query nucleotide or protein sequences to search. Requires FASTA format."
                    value={sequenceInput}
                    onChange={(e) => setSequenceInput(e.target.value)}
                    className="service-card-textarea"
                  />
                </div>
              )}

              {queryType === "selectFasta" && (
                <div className="service-card-content-grid-item">
                  <SearchWorkspaceInput
                    title="Upload a FASTA file"
                    placeholder="FASTA file..."
                  />
                </div>
              )}

              {queryType === "selectFeature" && (
                <div className="service-card-content-grid-item">
                  <SearchWorkspaceInput
                    title="Select a feature group"
                    placeholder="Feature group..."
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Output Settings Card */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            {/* TODO: Add the workspace folder selector here */}

            <div className="service-card-row">
              <div className="service-card-row-item">
                <div className="flex flex-row items-center gap-2">
                  <Label className="service-card-label">Database Source</Label>
                  <DialogInfoPopup
                    title={blastServiceDatabaseSource.title}
                    description={blastServiceDatabaseSource.description}
                    sections={blastServiceDatabaseSource.sections}
                    className="mb-2"
                    />
                </div>

                <Select>
                  <SelectTrigger className="service-card-select-trigger ">
                    <SelectValue placeholder="Select database source" />
                  </SelectTrigger>
                  {/* TODO: Conditionally render based on query type */}
                  <SelectContent>
                    <SelectItem value="reference">
                      Reference and representative genomes (bacteria, archaea)
                    </SelectItem>
                    <SelectItem value="reference-virus">
                      Reference and representative genomes (viruses)
                    </SelectItem>
                    <SelectItem value="search-genome-list">
                      Search within selected genome list
                    </SelectItem>
                    <SelectItem value="search-genome-group">
                      Search within selected genome group
                    </SelectItem>
                    <SelectItem value="search-feature-group">
                      Search within selected feature group
                    </SelectItem>
                    <SelectItem value="search-taxonomy">
                      Search within a taxon
                    </SelectItem>
                    <SelectItem value="search-fasta">
                      Search within selected FASTA file
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="service-card-row-item">
                <div className="flex flex-row items-center gap-2">
                  <Label className="service-card-label">Database Type</Label>
                  <DialogInfoPopup
                    title={blastServiceDatabaseType.title}
                    description={blastServiceDatabaseType.description}
                    sections={blastServiceDatabaseType.sections}
                    className="mb-2"
                  />
                </div>

                <Select>
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select database type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="genome-sequences">
                      Genome sequences (NT)
                    </SelectItem>
                    <SelectItem value="genes">Genes (NT)</SelectItem>
                    <SelectItem value="rnas">RNAs (NT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </div>

            <OutputFolder onChange={setOutputFolder} />

            <OutputFolder variant="name" onChange={setOutputName} />

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
                <div className="service-card-content-grid">
                  <div className="service-card-content-grid-item">
                    <Label htmlFor="max-hits" className="service-card-label">
                      Max Hits
                    </Label>

                    <Select>
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select max hits" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                        <SelectItem value="5000">5000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="service-card-content-grid-item">
                    <Label htmlFor="e-value" className="service-card-label">
                      E-Value Threshold
                    </Label>

                    <Select defaultValue="10">
                      <SelectTrigger className="service-card-select-trigger">
                        <SelectValue placeholder="Select E-Value Threshold" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.0001">0.0001</SelectItem>
                        <SelectItem value="0.001">0.001</SelectItem>
                        <SelectItem value="0.01">0.01</SelectItem>
                        <SelectItem value="0.1">0.1</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="1000">1000</SelectItem>
                        <SelectItem value="10000">10000</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </form>

      {/* Form Controls */}
      <div className="service-form-controls">
        <div className="flex items-center gap-2">
          <Checkbox id="view-results" />
          <Label htmlFor="view-results">View Results</Label>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
          className="service-form-controls-button"
        >
          Reset
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </section>
  );
}
