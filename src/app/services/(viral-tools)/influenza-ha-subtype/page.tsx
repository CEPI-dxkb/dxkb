"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { HelpCircle } from "lucide-react";
import { ServiceHeader } from "@/components/services/service-header";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import { HaReferenceTypes } from "@/types/services";
import { haSubtypeNumberingInput } from "@/lib/services/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import { handleFormSubmit } from "@/lib/services/service-utils";

export default function HASubtypeNumbering() {
  // States for the form
  const [inputSequence, setInputSequence] = useState("sequence");
  const [inputSequenceValue, setInputSequenceValue] = useState("");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");
  const [selectedSchemes, setSelectedSchemes] = useState(["H1PDM34"]);

  const handleReset = () => {
    setInputSequence("");
    setOutputFolder("");
    setOutputName("");
    setSelectedSchemes(["H1PDM34"]);
  };

  return (
    <section>
      <ServiceHeader
        title="HA Subtype Numbering Conversion"
        description="The HA Subtype Numbering Conversion service allows user to renumber
          Influenza HA sequences according to a cross-subtype numbering scheme
          proposed by Burke and Smith in <a href='https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4100033/'>Burke DF, Smith DJ (2014). A
          recommended numbering scheme for influenza A HA subtypes. PLUS One
          9:e112302</a>. Burke and Smith's numbering scheme uses analysis of known
          HA structures to identify amino acids that are structurally and
          functionally equivalent across all HA subtypes, using a numbering
          system based on the mature HA sequence."
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      {/* Main Form Content */}
      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Input Sequence
              <DialogInfoPopup
                title={haSubtypeNumberingInput.title}
                description={haSubtypeNumberingInput.description}
                sections={haSubtypeNumberingInput.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <RadioGroup
              defaultValue="sequence"
              className="service-radio-group"
              onValueChange={setInputSequence}
            >
              <div className="service-radio-group-item">
                <RadioGroupItem value="sequence" id="sequence" />
                <Label htmlFor="sequence">Enter Sequence</Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="fasta" id="fasta" />
                <Label htmlFor="fasta">Select FASTA File</Label>
              </div>
              <div className="service-radio-group-item">
                <RadioGroupItem value="feature-group" id="feature-group" />
                <Label htmlFor="feature-group">Feature Group</Label>
              </div>
            </RadioGroup>

            {inputSequence === "sequence" && (
              <Textarea
                placeholder="Enter one or more protein sequences..."
                className="service-card-textarea"
                value={inputSequenceValue}
                onChange={(e) => setInputSequenceValue(e.target.value)}
              />
            )}

            {inputSequence === "fasta" && (
              <SearchWorkspaceInput
                title={null}
                placeholder="Select FASTA File"
              />
            )}

            {inputSequence === "feature-group" && (
              <SearchWorkspaceInput
                title={null}
                placeholder="Select Feature Group"
              />
            )}

            <div className="space-y-6">
              <div>
                <div className="flex flex-row gap-2">
                  <Label className="service-card-label">
                    Conversion Sequence Numbering Scheme
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="service-card-tooltip-icon mb-2" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Selects the subtype(s) (one or more) to which
                          numbering scheme conversion is desired.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="bg-background/20 grid grid-cols-2 gap-2 rounded-md border p-4 md:grid-cols-4">
                  {HaReferenceTypes.map((scheme) => (
                    <div className="flex items-center gap-2" key={scheme.id}>
                      <Checkbox
                        id={scheme.id}
                        checked={selectedSchemes.includes(scheme.id)}
                        onCheckedChange={() =>
                          setSelectedSchemes(
                            selectedSchemes.includes(scheme.id)
                              ? selectedSchemes.filter((s) => s !== scheme.id)
                              : [...selectedSchemes, scheme.id],
                          )
                        }
                        className="service-card-checkbox"
                      />
                      <Label htmlFor={scheme.id} className="text-sm">
                        {scheme.label}
                      </Label>
                    </div>
                  ))}
                </div>
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
