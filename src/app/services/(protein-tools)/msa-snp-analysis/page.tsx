"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ServiceHeader } from "@/components/services/service-header";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import OutputFolder from "@/components/services/output-folder";
import { handleFormSubmit } from "@/lib/service-utils";
import { ChevronDown } from "lucide-react";
import {
  msaSNPAnalysisInfo,
  msaSNPAnalysisParameters,
  msaSNPAnalysisSelectSequences,
  msaSNPAnalysisStartWith,
} from "@/lib/service-info";

export default function MSAandSNPAnalysisPage() {
  const [alignmentType, setAlignmentType] = useState("unaligned");
  const [sequenceType, setSequenceType] = useState("feature-group");
  const [_featureGroupType, setFeatureGroupType] = useState("protein");
  const [refSeqType, setRefSeqType] = useState("none");
  const [showStrategy, setShowStrategy] = useState(false);
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  // TODO: There is probably a better way to do all this conditional rendering.
  return (
    <section>
      <ServiceHeader
        title="MSA & SNP / Variation Analysis"
        description="The Multiple Sequence Alignment and SNP / Variation Analysis Service
          allows users to choose an alignment algorithm to align sequences selected from a search result,
          a FASTA file saved to the workspace, or through simply cutting and pasting.
          The service can also be used for variation and SNP analysis with feature groups, FASTA files, aligned FASTA files, and user input FASTA records."
        infoPopupTitle={msaSNPAnalysisInfo.title}
        infoPopupDescription={msaSNPAnalysisInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      {/* Main Content */}
      <form onSubmit={handleFormSubmit} className="service-form-section">
        {/* Start with */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Start with:
              <DialogInfoPopup
                title={msaSNPAnalysisStartWith.title}
                description={msaSNPAnalysisStartWith.description}
                sections={msaSNPAnalysisStartWith.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <RadioGroup
              onValueChange={setAlignmentType}
              defaultValue="unaligned"
              className="service-radio-group"
            >
              <div className="service-radio-group-item">
                <RadioGroupItem value="unaligned" id="unaligned" />
                <Label htmlFor="unaligned">Unaligned Sequences</Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="aligned" id="aligned" />
                <Label htmlFor="aligned">Aligned Sequences</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Select sequences conditional */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Select sequences:
              <DialogInfoPopup
                title={msaSNPAnalysisSelectSequences.title}
                description={msaSNPAnalysisSelectSequences.description}
                sections={msaSNPAnalysisSelectSequences.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            {alignmentType === "unaligned" ? (
              <div className="space-y-6">
                <RadioGroup
                  onValueChange={setSequenceType}
                  defaultValue="feature-group"
                  className="service-radio-group"
                >
                  <div className="service-radio-group-item">
                    <RadioGroupItem value="feature-group" id="feature-group" />
                    <Label htmlFor="feature-group">Feature Group</Label>
                  </div>
                  <div className="service-radio-group-item">
                    <RadioGroupItem
                      value="viral-genome-group"
                      id="viral-genome-group"
                    />
                    <Label htmlFor="viral-genome-group">
                      Viral Genome Group
                    </Label>
                  </div>
                  <div className="service-radio-group-item">
                    <RadioGroupItem
                      value="dna-protein-fasta"
                      id="dna-protein-fasta"
                    />
                    <Label htmlFor="dna-protein-fasta">
                      DNA or Protein FASTA File
                    </Label>
                  </div>
                  <div className="service-radio-group-item">
                    <RadioGroupItem
                      value="input-sequence"
                      id="input-sequence"
                    />
                    <Label htmlFor="input-sequence">Input Sequence</Label>
                  </div>
                </RadioGroup>

                {sequenceType === "feature-group" && (
                  <>
                    <SearchWorkspaceInput
                      title={null}
                      placeholder="Feature Group..."
                    />

                    <div className="service-radio-group">
                      <RadioGroup
                        onValueChange={setFeatureGroupType}
                        defaultValue="protein"
                        className="service-radio-group"
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
                  </>
                )}
                {sequenceType === "viral-genome-group" && (
                  <SearchWorkspaceInput
                    title={null}
                    placeholder="Viral Genome Group..."
                  />
                )}
                {sequenceType === "dna-protein-fasta" && (
                  <SearchWorkspaceInput
                    title={null}
                    placeholder="DNA or Protein FASTA File..."
                  />
                )}
                {sequenceType === "input-sequence" && (
                  <Textarea
                    placeholder="Enter FASTA records of sequences to align"
                    className="service-card-textarea"
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <SearchWorkspaceInput
                  title="Select a Aligned FASTA File..."
                  placeholder="Aligned FASTA File..."
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Select a reference sequence */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Select a reference sequence:
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-6">
              <RadioGroup
                onValueChange={setRefSeqType}
                defaultValue="none"
                className="service-radio-group"
              >
                <div className="service-radio-group-item">
                  <RadioGroupItem value="none" id="none" />
                  <Label htmlFor="none">None</Label>
                </div>
                {sequenceType === "feature-group" && (
                  <div className="service-radio-group-item">
                    <RadioGroupItem value="feature-id" id="feature-id" />
                    <Label htmlFor="feature-id">Feature ID</Label>
                  </div>
                )}
                {sequenceType === "viral-genome-group" && (
                  <div className="service-radio-group-item">
                    <RadioGroupItem value="genome-id" id="genome-id" />
                    <Label htmlFor="genome-id">Genome ID</Label>
                  </div>
                )}
                {(sequenceType === "dna-protein-fasta" ||
                  sequenceType === "input-sequence") && (
                  <div className="service-radio-group-item">
                    <RadioGroupItem
                      value="first-sequence"
                      id="first-sequence"
                    />
                    <Label htmlFor="first-sequence">First Sequence</Label>
                  </div>
                )}
                <div className="service-radio-group-item">
                  <RadioGroupItem value="input-ref-seq" id="input-ref-seq" />
                  <Label htmlFor="input-ref-seq">
                    Input Reference Sequence
                  </Label>
                </div>
              </RadioGroup>

              {refSeqType === "feature-id" && (
                <SearchWorkspaceInput
                  title={null}
                  placeholder="Feature ID..."
                />
              )}
              {refSeqType === "genome-id" && (
                <SearchWorkspaceInput title={null} placeholder="Genome ID..." />
              )}
              {refSeqType === "first-sequence" && <></>}
              {refSeqType === "input-ref-seq" && (
                <Textarea
                  placeholder="Enter a FASTA record of a reference sequence to align"
                  className="service-card-textarea"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Parameters */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters:
              <DialogInfoPopup
                title={msaSNPAnalysisParameters.title}
                description={msaSNPAnalysisParameters.description}
                sections={msaSNPAnalysisParameters.sections}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="w-full space-y-2">
                <Label>Aligner</Label>
                <Select defaultValue="mafft">
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select aligner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mafft">Mafft</SelectItem>
                    <SelectItem value="muscle">Muscle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Collapsible
                open={showStrategy}
                onOpenChange={setShowStrategy}
                className="service-collapsible-container"
              >
                <CollapsibleTrigger className="service-collapsible-trigger text-sm font-medium">
                  Strategy Options
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showStrategy ? "rotate-180 transform" : ""}`}
                  />
                </CollapsibleTrigger>

                <CollapsibleContent className="service-collapsible-content">
                  <div className="space-y-4 p-2">
                    <RadioGroup defaultValue="auto">
                      <div className="space-y-2">
                        <Label>Automatic</Label>
                        <div className="flex items-center space-x-2 pl-4">
                          <RadioGroupItem value="auto" id="auto" />
                          <Label htmlFor="auto" className="font-normal">
                            Auto (FFT-NS-1, FFT-NS-2, FFT-NS-i, L-INS-i depends
                            on data size)
                          </Label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Progressive Methods</Label>
                        <div className="space-y-2 pl-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fft-ns-1" id="fft-ns-1" />
                            <Label htmlFor="fft-ns-1" className="font-normal">
                              FFT-NS-1 (very fast, recommended for {"<"}2,000
                              sequences, progressive method)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fft-ns-2" id="fft-ns-2" />
                            <Label htmlFor="fft-ns-2" className="font-normal">
                              FFT-NS-2 (fast, progressive method)
                            </Label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Iterative Refinement Methods</Label>
                        <div className="space-y-2 pl-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="fft-ns-i" id="fft-ns-i" />
                            <Label htmlFor="fft-ns-i" className="font-normal">
                              FFT-NS-i (iterative refinement method)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="e-ins-i" id="e-ins-i" />
                            <Label htmlFor="e-ins-i" className="font-normal">
                              E-INS-i (very slow, recommended for {"<"}200
                              sequences with multiple conserved domains and long
                              gaps, 5 iterative cycles only)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="l-ins-i" id="l-ins-i" />
                            <Label htmlFor="l-ins-i" className="font-normal">
                              L-INS-i (very slow, recommended for {"<"}200
                              sequences with one conserved domain and long gaps,
                              2 iterative cycles only)
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="g-ins-i" id="g-ins-i" />
                            <Label htmlFor="g-ins-i" className="font-normal">
                              G-INS-i (very slow, recommended for {"<"}200
                              sequences with global homology, 2 iterative cycles
                              only)
                            </Label>
                          </div>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex flex-col space-y-6">
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

        {/* Form Controls */}
        <div className="service-form-controls">
          <Button variant="outline">Reset</Button>
          <Button>Submit</Button>
        </div>
      </form>
    </section>
  );
}
