"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FileDown,
  Search,
  ExternalLink,
  Database,
  BarChart4,
  ChevronDown,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  similarGenomeFinderAdvancedParameters,
  similarGenomeFinderInfo,
  similarGenomeFinderSelectGenome,
} from "@/lib/service-info";
import { ServiceHeader } from "@/components/services/service-header";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import { handleFormSubmit } from "@/lib/service-utils";

const SimilarGenomeFinderInterface = () => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [_scope, setScope] = useState("reference");

  return (
    <section>
      <ServiceHeader
        title="Similar Genome Finder"
        description="Specifies the genome to use as the basis for finding other similar genomes. Search by Genome Name or Genome ID.
          Selection box for specifying genome to use as the basis of comparison, or upload a FASTA file."
        infoPopupTitle={similarGenomeFinderInfo.title}
        infoPopupDescription={similarGenomeFinderInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form onSubmit={handleFormSubmit} className="service-form-section">
        {/* Select a Genome Section */}
        <Card>
          <CardHeader className="service-card-header">
            <div className="flex items-center">
              <CardTitle className="service-card-title">
                Select a Genome
              </CardTitle>
              <DialogInfoPopup
                title={similarGenomeFinderSelectGenome.title}
                description={similarGenomeFinderSelectGenome.description}
                sections={similarGenomeFinderSelectGenome.sections}
                className="ml-2"
              />
            </div>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-2">
              <Label className="service-card-label">
                Search by Genome Name or Genome ID
              </Label>
              <div className="flex space-x-2">
                <Input
                  placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                  className="service-card-input"
                />
                <Button variant="outline" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <SearchWorkspaceInput
              title="Or Upload FASTA/FASTQ"
              placeholder="FASTA/FASTQ file..."
            />

            {/* Parameters Section */}
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
                <div className="flex w-full flex-col justify-between space-y-4">
                  <div className="flex items-center">
                    <Label className="service-card-label">Parameters</Label>
                    <DialogInfoPopup
                      title={similarGenomeFinderAdvancedParameters.title}
                      description={
                        similarGenomeFinderAdvancedParameters.description
                      }
                      sections={similarGenomeFinderAdvancedParameters.sections}
                      className="mb-2 ml-2"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label className="service-card-sublabel">Max Hits</Label>
                      <Select defaultValue="50">
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="50" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="service-card-sublabel">
                        P-Value Threshold
                      </Label>

                      <Select defaultValue="1">
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="1" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.001">0.001</SelectItem>
                          <SelectItem value="0.01">0.01</SelectItem>
                          <SelectItem value="0.1">0.1</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="service-card-sublabel">Distance</Label>

                      <Select defaultValue="1">
                        <SelectTrigger className="service-card-select-trigger">
                          <SelectValue placeholder="1" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.01">0.01</SelectItem>
                          <SelectItem value="0.05">0.05</SelectItem>
                          <SelectItem value="0.1">0.1</SelectItem>
                          <SelectItem value="0.5">0.5</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="flex flex-col gap-2">
                        <Label className="service-card-label">
                          Organism Type
                        </Label>

                        <div className="flex items-center space-x-2">
                          <Checkbox id="bacteria" defaultChecked />
                          <Label
                            htmlFor="bacteria"
                            className="text-sm font-normal"
                          >
                            Bacterial and Archaeal Genomes
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="viral" defaultChecked />
                          <Label
                            htmlFor="viral"
                            className="text-sm font-normal"
                          >
                            Viral Genomes
                          </Label>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Label className="service-card-label">Scope</Label>

                        <RadioGroup
                          className="gap-2"
                          defaultValue="reference"
                          onValueChange={setScope}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="reference" />
                            <Label
                              htmlFor="reference"
                              className="text-sm font-normal"
                            >
                              Reference and Representative Genomes
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="all" />
                            <Label
                              htmlFor="all"
                              className="text-sm font-normal"
                            >
                              All Public Genomes
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </form>

      {/* Submit Button */}
      <div className="service-form-controls">
        <Button>
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>

      {/* Results Section - Would appear after search */}
      <div className="mx-auto mt-12 hidden max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Found 15 similar genomes (showing top 10)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Results table would go here */}
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Genome</th>
                    <th className="px-4 py-2 text-left">Organism</th>
                    <th className="px-4 py-2 text-left">Distance</th>
                    <th className="px-4 py-2 text-left">P-value</th>
                    <th className="px-4 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Sample result rows */}
                  <tr className="border-t">
                    <td className="px-4 py-2">Genome 1</td>
                    <td className="px-4 py-2">Organism A</td>
                    <td className="px-4 py-2">0.02</td>
                    <td className="px-4 py-2">0.001</td>
                    <td className="px-4 py-2">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Database className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-t">
                    <td className="px-4 py-2">Genome 2</td>
                    <td className="px-4 py-2">Organism B</td>
                    <td className="px-4 py-2">0.05</td>
                    <td className="px-4 py-2">0.003</td>
                    <td className="px-4 py-2">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Database className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" />
              Export Results
            </Button>
            <Button variant="outline">
              <BarChart4 className="mr-2 h-4 w-4" />
              Visualize Comparisons
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  );
};

export default SimilarGenomeFinderInterface;
