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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Search, HelpCircle } from "lucide-react";
import {
  genomeAnnotationInfo,
  genomeAnnotationParameters,
} from "@/lib/service-info";
import { handleFormSubmit } from "@/lib/service-utils";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import SearchWorkspaceInput from "@/components/services/search-workspace-input";
import { TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";

const GenomeAnnotationContent = () => {
  const [_outputFolder, setOutputFolder] = useState("");
  const [_outputName, setOutputName] = useState("");

  return (
    <section>
      <ServiceHeader
        title="Genome Annotation"
        description="The Genome Annotation Service uses the RAST tool kit, RASTtk, for bacteria and the Viral Genome ORF Reader (VIGOR4) for viruses.
          The service accepts a FASTA formatted contig file and an annotation recipe based on taxonomy to provide an annotated genome, to provide annotation of genomic features."
        infoPopupTitle={genomeAnnotationInfo.title}
        infoPopupDescription={genomeAnnotationInfo.description}
        quickReferenceGuide="#"
        tutorial="#"
        instructionalVideo="#"
      />

      <form onSubmit={handleFormSubmit} className="service-form-section">
        {/* Contigs Upload */}
        <Card>
          <CardHeader className="service-card-header">
            <CardTitle className="service-card-title">
              Parameters
              <DialogInfoPopup
                title={genomeAnnotationParameters.title}
                description={genomeAnnotationParameters.description}
                sections={genomeAnnotationParameters.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div id="parameters-content" className="space-y-6">
              <SearchWorkspaceInput
                title="Contigs"
                placeholder="Select Contigs..."
              />

              <div>
                <Label className="service-card-label">Annotation Recipe</Label>

                <Select>
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="--- Select Recipe ---" />
                  </SelectTrigger>
                  <SelectContent className="service-card-select-content">
                    <SelectItem value="bacteria-archaea">
                      Bacteria / Archaea
                    </SelectItem>
                    <SelectItem value="viruses">Viruses</SelectItem>
                    <SelectItem value="bacteriophage">Bacteriophage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex w-full flex-col">
                  <div className="flex flex-row items-center gap-2">
                    <Label className="service-card-label">Taxonomy Name</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="service-card-tooltip-icon mb-2" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p>
                            Taxon must be specified at the genus level or below
                            to get the latest protein family predictions.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex flex-row">
                    <Input
                      placeholder="e.g. Bacillus cereus..."
                      className="service-card-input"
                    />
                    <Button variant="outline" className="ml-2" size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex w-full flex-col sm:w-[50%]">
                  <Label className="service-card-label">Taxonomy ID</Label>
                  <div className="flex flex-row">
                    <Input
                      placeholder="ID Number..."
                      className="service-card-input"
                    />
                    <Button variant="outline" className="ml-2" size="icon">
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <Label className="service-card-label">My Label</Label>
                <Input
                  placeholder="My identifier123"
                  className="service-card-input"
                />
              </div>

              <div>
                <OutputFolder onChange={setOutputFolder} />
              </div>

              <div>
                <OutputFolder
                  variant="name"
                  onChange={setOutputName}
                  disabled
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <div className="service-form-controls">
        <Button variant="outline" type="reset">
          Reset
        </Button>
        <Button type="submit">Annotate</Button>
      </div>
    </section>
  );
};

export default GenomeAnnotationContent;
