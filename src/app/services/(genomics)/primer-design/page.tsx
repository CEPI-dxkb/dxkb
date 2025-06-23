"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ServiceHeader } from "@/components/services/service-header";
import { primerDesignInfo, primerDesignInputSequence } from "@/lib/service-info";
import { handleFormSubmit } from "@/lib/service-utils";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";

const PrimerDesignInterface = () => {
  const [sequenceInputMethod, setSequenceInputMethod] = useState("paste-sequence");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");

  return (
    <section>
      <ServiceHeader
        title="Primer Design"
        description="The Primer Design Service utilizes Primer3 to design primers from a given \
          input sequence under a variety of temperature, size, and concentration constraints."
        infoPopupTitle={primerDesignInfo.title}
        infoPopupDescription={primerDesignInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form
        onSubmit={handleFormSubmit}
        className="service-form-section"
      >
        {/* Input Sequence Section */}
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

          <CardContent className="service-card-content">
            {/* Input Method Tabs */}
            <Tabs
              defaultValue="paste"
              value={sequenceInputMethod}
              onValueChange={setSequenceInputMethod}
              className="w-full"
            >
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="paste-sequence">Paste Sequence</TabsTrigger>
                <TabsTrigger value="workspace-fasta">Workspace FASTA</TabsTrigger>
              </TabsList>

              {/* Paste Sequence Content */}
              <TabsContent value="paste-sequence" className="mt-0">
                {/* Sequence Identifier */}
                <div className="mb-4 space-y-2">
                  <Label className="service-card-label">Sequence Identifier</Label>
                  <Input placeholder="Identifier for input sequence" className="service-card-input" />
                </div>

                <div className="space-y-2">
                  <Label className="service-card-label">Paste Sequence</Label>
                  <Textarea
                    placeholder="Enter nucleotide sequence"
                    className="service-card-textarea"
                  />
                </div>

                <div className="flex items-center align-middle space-x-2 pt-2">
                  <Label className="service-card-sublabel !mb-0">
                    Mark Selected Region
                  </Label>
                  <div className="flex space-x-1">
                    <Button variant="outline" size="sm" className="h-8 px-2">
                      <span>{"< >"}</span>
                    </Button>
                    <div className="flex space-x-1">
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <span>[ ]</span>
                      </Button>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                        <span>{"{ }"} </span>
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="h-8">
                      clear
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Workspace FASTA Content */}
              <TabsContent value="workspace-fasta" className="mt-0">
                <SearchWorkspaceInput
                  title="FASTA File"
                  placeholder="Select FASTA File..."
                />
              </TabsContent>
            </Tabs>

            {/* Mark Selected Region */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center space-x-2">
                <Switch id="pick-internal-oligo" defaultChecked={true} />
                <Label htmlFor="pick-internal-oligo" className="text-sm">
                  Pick Internal Oligo
                </Label>
              </div>
            </div>

            {/* Product Size Range */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center">
                <Label className="service-card-label">Product Size Range (BP)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <HelpCircle className="service-card-tooltip-icon mb-2" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-[300px] space-y-2">
                        <p>
                          Minimum, Optimum, and Maximum lengths (in bases) of the PCR product.
                          Primer3 will not generate primers with products shorter than Min or
                          longer than Max, and with default arguments Primer3 will attempt
                          to pick primers producing products close to the Optimum length.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input defaultValue="50-200" className="service-card-input" />
            </div>

            {/* Primer Size */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="service-card-label">Primer Size (BP)</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <HelpCircle className="service-card-tooltip-icon mb-2" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="max-w-[300px] space-y-2">
                        <p>
                          Minimum, Optimum, and Maximum lengths (in bases) of a primer oligo.
                          Primer3 will not pick primers shorter than Min or longer than Max, and with default arguments will attempt to pick primers close with size close to Opt.
                          Min cannot be smaller than 1. Max cannot be larger than 36. (This limit is governed by maximum oligo size for which melting-temperature calculations are valid.)
                          Min cannot be greater than Max.
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="service-card-sublabel">Min</Label>
                  <Input defaultValue="18" className="service-card-input" />
                </div>
                <div className="space-y-1">
                  <Label className="service-card-sublabel">Opt</Label>
                  <Input defaultValue="20" className="service-card-input" />
                </div>
                <div className="space-y-1">
                  <Label className="service-card-sublabel">Max</Label>
                  <Input defaultValue="27" className="service-card-input" />
                </div>
              </div>
            </div>

            {/* Excluded Regions */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="service-card-label">Excluded Regions</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <HelpCircle className="service-card-tooltip-icon mb-2" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Regions to avoid when designing primers</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex flex-row items-center">
                {"<"}
                <Input
                  placeholder="401,7 68,3 forbids primers in the 7 bases starting at 401 and the 3 bases at 68."
                  className="service-card-input mx-2"
                />
                {">"}
              </div>
            </div>

            {/* Target Region */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="service-card-label">
                  Target Region
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <HelpCircle className="service-card-tooltip-icon mb-2" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Regions that must be included in the PCR product</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex flex-row items-center">
                {"["}
                <Input
                  placeholder="50,2 requires primers to surround the 2 bases at positions 50 and 51."
                  className="service-card-input mx-2"
                />
                {"]"}
              </div>
            </div>

            {/* Included Regions */}
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="service-card-label">Included Regions</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <HelpCircle className="service-card-tooltip-icon mb-2" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Regions where primers must be selected</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="flex flex-row items-center">
                {"{"}
                <Input
                  placeholder="20,400: only pick primers in the 400 base region starting at position 20."
                  className="service-card-input mx-2"
                />
                {"}"}
              </div>
            </div>

            {/* Primer Overlap Positions */}
            <div className="space-y-2">
              <Label className="service-card-label">Primer Overlap Positions</Label>
              <div className="flex flex-row items-center">
                {"-"}
                <Input
                  placeholder="Space-separated list of positions. The forward OR reverse primer will overlap one."
                  className="service-card-input m-2"
                />
                {"-"}
              </div>
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
                  <div className="flex flex-row items-center">
                    <div className="space-y-2 w-full">
                      <div className="flex flex-row items-center">
                        <Label className="service-card-label">
                          Number to Return
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="ml-2">
                              <HelpCircle className="service-card-tooltip-icon mb-2" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="max-w-[300px] space-y-2">
                                <p>
                                The maximum number of primer pairs to return. Primer pairs returned are sorted by their &apos;quality&apos;, in
                                other words by the value of the objective function (where a lower number indicates a better primer
                                pair). Caution: setting this parameter to a large value will increase running time.
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Input placeholder="Max number of primers to return (5)" className="service-card-input" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label className="service-card-label">
                        Primer Tm (°C)
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="ml-2">
                            <HelpCircle className="service-card-tooltip-icon mb-2" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-[300px] space-y-2">
                              <p>
                                Minimum, Optimum, and Maximum melting temperatures (Celsius) for a primer oligo. Primer3 will not
                                pick oligos with temperatures smaller than Min or larger than Max, and with default conditions will try
                                to pick primers with melting temperatures close to Opt.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="service-card-sublabel">Min</Label>
                        <Input defaultValue="57.0" className="service-card-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="service-card-sublabel">Opt</Label>
                        <Input defaultValue="60.0" className="service-card-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="service-card-sublabel">Max</Label>
                        <Input defaultValue="63.0" className="service-card-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="service-card-sublabel">Max TM Difference</Label>
                        <Input defaultValue="100.0" className="service-card-input" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center">
                      <Label className="service-card-label">
                        Primer GC%
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="ml-2">
                            <HelpCircle className="service-card-tooltip-icon mb-2" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="max-w-[300px] space-y-2">
                              <p>
                                Minimum, Optimum, and Maximum percentage of Gs and Cs in any primer or oligo.
                              </p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="service-card-sublabel">Min</Label>
                        <Input defaultValue="20.0" className="service-card-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="service-card-sublabel">Opt</Label>
                        <Input defaultValue="50.0" className="service-card-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="service-card-sublabel">Max</Label>
                        <Input defaultValue="80.0" className="service-card-input" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="service-card-label">
                        Concentration of Monovalent Cations (MM)
                      </Label>
                      <Input defaultValue="50.0" className="service-card-input" />
                    </div>

                    <div className="space-y-2">
                      <Label className="service-card-label">
                        Concentration of Divalent Cations (MM)
                      </Label>
                      <Input defaultValue="1.5" className="service-card-input" />
                    </div>

                    <div className="space-y-2">
                      <Label className="service-card-label">
                        Annealing Oligo Concentration (MM)
                      </Label>
                      <Input defaultValue="50.0" className="service-card-input" />
                    </div>

                    <div className="space-y-2">
                      <Label className="service-card-label">
                        Concentration of DNTPS (MM)
                      </Label>
                      <Input defaultValue="0.6" className="service-card-input" />
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Output
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <OutputFolder onChange={setOutputFolder} />

            <OutputFolder variant="name" onChange={setOutputName} />
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="service-form-controls">
          <Button variant="outline" type="reset">
            Reset
          </Button>
          <Button
            type="submit"
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Submit
          </Button>
        </div>
      </form>
    </section>
  );
};

export default PrimerDesignInterface;
