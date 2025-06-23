"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ServiceHeader } from "@/components/services/service-header";
import {
  subspeciesClassificationQuerySource,
  subspeciesClassificationInfo,
  subspeciesClassificationSpeciesInfo,
} from "@/lib/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import OutputFolder from "@/components/services/output-folder";
import { subspeciesClassificationSpeciesList } from "@/types/services";
import { handleFormSubmit } from "@/lib/service-utils";

export default function SubspeciesClassification() {
  // States for the form
  const [querySequence, setQuerySequence] = useState("");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  const [querySource, setQuerySource] = useState("enter-sequence");
  const [species, setSpecies] = useState(
    subspeciesClassificationSpeciesList[0].id,
  );

  const handleReset = () => {
    setQuerySequence("");
    setOutputFolder("");
    setOutputName("");
  };

  return (
    <section>
      <ServiceHeader
        title="Subspecies Classification"
        description='The Subspecies Classification tool assigns the genotype/subtype of a
          virus, based on the genotype/subtype assignments maintained by the
          International Committee on Taxonomy of Viruses (ICTV). This tool
          infers the genotype/subtype for a query sequence from its position
          within a reference tree. The service uses the pplacer tool with a
          reference tree and reference alignment and includes the query sequence
          as input. Interpretation of the pplacer result is handled by
          Cladinator. Link to <a href="#" className="text-primary hover:underline">pplacer</a>{" "}
          and <a href="#" className="text-primary hover:underline">Cladinator</a>'
        infoPopupTitle={subspeciesClassificationInfo.title}
        infoPopupDescription={subspeciesClassificationInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      {/* Main Form Content */}
      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 gap-6">
        {/* Query Source Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Query Source
              <DialogInfoPopup
                title={subspeciesClassificationQuerySource.title}
                description={subspeciesClassificationQuerySource.description}
                sections={subspeciesClassificationQuerySource.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <RadioGroup
              defaultValue="enter-sequence"
              className="service-radio-group"
              onValueChange={setQuerySource}
            >
              <div className="service-radio-group-item">
                <RadioGroupItem value="enter-sequence" id="enter-sequence" />
                <Label htmlFor="enter-sequence">Enter Sequence</Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="fasta-file" id="fasta-file" />
                <Label htmlFor="fasta-file">Select FASTA File</Label>
              </div>
            </RadioGroup>

            {querySource === "enter-sequence" && (
              <Textarea
                placeholder="Enter one or more nucleotide or protein sequences (FASTA format)..."
                className="service-card-textarea"
                value={querySequence}
                onChange={(e) => setQuerySequence(e.target.value)}
              />
            )}

            {querySource === "fasta-file" && (
              <SearchWorkspaceInput
                title={null}
                placeholder="Select FASTA File"
              />
            )}
          </CardContent>
        </Card>

        {/* Species Selection */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Species
              <DialogInfoPopup
                title={subspeciesClassificationSpeciesInfo.title}
                description={subspeciesClassificationSpeciesInfo.description}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-6">
              <div className="w-full">
                <Label className="service-card-label">Select Species</Label>

                <Select defaultValue={species} onValueChange={setSpecies}>
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select species" />
                  </SelectTrigger>
                  <SelectContent className="max-h-128 overflow-y-auto">
                    {subspeciesClassificationSpeciesList.map((species) => (
                      <SelectItem key={species.id} value={species.id}>
                        {species.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
      </form>

      {/* Action Buttons */}
      <div className="service-form-controls">
        <Button variant="outline" onClick={handleReset}>
          Reset
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </section>
  );
}
