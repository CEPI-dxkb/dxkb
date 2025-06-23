"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ServiceHeader } from "@/components/services/service-header";
import {
  genomeAlignmentAdvancedParamaterOptions,
  genomeAlignmentMauveInfo,
  genomeAlignmentSelectGenomes,
} from "@/lib/service-info";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import SelectedItemsTable from "@/components/services/selected-items-table";
import { addGenome, handleFormSubmit, removeFromSelectedGenomes } from "@/lib/service-utils";
import { Genome } from "@/types/services";
import OutputFolder from "@/components/services/output-folder";

const GenomeAlignmentInterface = () => {
  const [selectedGenomes, setSelectedGenomes] = useState<Genome[]>([]);
  const [isManualSeedWeight, setIsManualSeedWeight] = useState(false);
  const [seedWeight, setSeedWeight] = useState([11]); // Default value centered
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [genomeInput, setGenomeInput] = useState("");
  const [genomeGroupInput, setGenomeGroupInput] = useState("");
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");

  return (
    <section>
      <ServiceHeader
        title="Genome Alignment (Mauve)"
        description="The BLAST service uses BLAST (Basic Local Alignment Search Tool) to search against using <a href='https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0011147'>progressiveMauve</a>."
        infoPopupTitle={genomeAlignmentMauveInfo.title}
        infoPopupDescription={genomeAlignmentMauveInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form onSubmit={handleFormSubmit} className="service-form-section">
        {/* Select Genomes Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Select Genomes
              <DialogInfoPopup
                title={genomeAlignmentSelectGenomes.title}
                description={genomeAlignmentSelectGenomes.description}
                sections={genomeAlignmentSelectGenomes.sections}
              />
            </CardTitle>
            <CardDescription>
              Add at least 2 (up to 20) genomes. Note the first genome selected
              will be the reference (anchor) genome.
            </CardDescription>
          </CardHeader>

          <CardContent className="service-card-content">
            {/* Genome Search */}
            {/* TODO: Change these to properly support Genomes and Genome Groups */}
            <div className="service-card-content-grid-item">
              <SearchWorkspaceInput
                title="Select Genome"
                placeholder="Genome..."
                variant="add"
                value={genomeInput}
                onChange={setGenomeInput}
                onAdd={() => {
                  const genome: Genome = { id: genomeInput, name: genomeInput };
                  setSelectedGenomes(addGenome(genome, selectedGenomes));
                }}
              />
            </div>

            {/* Select Genome Group */}
            <div className="service-card-content-grid-item">
              <SearchWorkspaceInput
                title="And/Or Select Genome Group"
                placeholder="Genome Group (Optional)"
                variant="add"
                value={genomeGroupInput}
                onChange={setGenomeGroupInput}
                onAdd={() => {
                  const genome: Genome = {
                    id: genomeGroupInput,
                    name: genomeGroupInput,
                  };
                  setSelectedGenomes(addGenome(genome, selectedGenomes));
                }}
              />
            </div>

            {/* Selected Genomes List */}
            {/* TODO: Change this table to display 2 columns (Genome name, genome ID) like BVBRC */}
            <div>
              <SelectedItemsTable
                title="Selected Genomes"
                items={selectedGenomes.map((genome) => ({
                  id: genome.id,
                  name: genome.name,
                  type: "Genome",
                }))}
                onRemove={(id) => {
                  const newGenomes = removeFromSelectedGenomes(
                    id,
                    selectedGenomes,
                  );
                  setSelectedGenomes(newGenomes);
                }}
                className="max-h-84 overflow-y-auto"
              />
            </div>
          </CardContent>
        </Card>

        {/* Parameters Section */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
              <DialogInfoPopup
                title={genomeAlignmentAdvancedParamaterOptions.title}
                description={
                  genomeAlignmentAdvancedParamaterOptions.description
                }
                sections={genomeAlignmentAdvancedParamaterOptions.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
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
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="space-y-2 sm:min-w-fit">
                    <Label className="service-card-label">
                      Manually Set Seed Weight
                    </Label>
                    <Switch
                      id="manual-seed-weight"
                      checked={isManualSeedWeight}
                      onCheckedChange={setIsManualSeedWeight}
                    />
                  </div>
                  {isManualSeedWeight && (
                    <div className="w-full space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="service-card-label">
                            Seed Weight
                          </Label>
                          <span className="text-muted-foreground text-sm">
                            {seedWeight[0]}
                          </span>
                        </div>
                        <Slider
                          value={seedWeight}
                          onValueChange={setSeedWeight}
                          min={3}
                          max={21}
                          step={1}
                          className="w-full"
                        />
                        <div className="text-muted-foreground flex justify-between text-xs">
                          <span>3</span>
                          <span>21</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* TODO: Change to NumberInput component */}
                <div className="w-full space-y-2">
                  <Label className="service-card-label">Weight</Label>
                  <Input
                    placeholder="Min pairwise LCB score"
                    className="service-card-input"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </form>

      {/* Submit Buttons */}
      <div className="service-form-controls">
        <Button variant="outline" type="reset">
          Reset
        </Button>
        <Button type="submit">Submit</Button>
      </div>
    </section>
  );
};

export default GenomeAlignmentInterface;
