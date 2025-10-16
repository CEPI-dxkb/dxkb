"use client";

import { z } from "zod"
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  blastServiceInputSource,
  blastServiceDatabaseSource,
  blastServiceDatabaseType,
} from "@/lib/service-info";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { Checkbox } from "@/components/ui/checkbox";
import OutputFolder from "@/components/services/output-folder";
import { handleFormSubmit } from "@/lib/service-utils";

const decisionTree = {
  "blast_program": {
    "blastn": {
      "valid_databases": {
        "bacteria-archaea": {
          "valid_db_types": ["fna", "ffn", "faa", "frn"],
        },
        "viral-reference": {
          "valid_db_types": ["fna", "ffn", "faa", "frn"],
        },
        "selGenome": {
          "valid_db_types": ["fna", "ffn", "faa", "frn"],
        },
        "selGroup": {
          "valid_db_types": ["fna", "ffn", "faa", "frn"],
        },
        "selFeatureGroup": {
          "valid_db_types": ["fna", "ffn", "faa", "frn"],
        },
        "selTaxon": {
          "valid_db_types": ["fna", "ffn", "faa", "frn"],
        },
        "selFasta": {
          "valid_db_types": ["fna", "ffn", "faa", "frn"],
        },
      },
    },
    "blastp": {
      "valid_databases": ["bacteria-archaea", "viral-reference", "selGenome", "selGroup", "selFeatureGroup", "selTaxon", "selFasta"],
    },
    "blastx": {
      "valid_databases": ["bacteria-archaea", "viral-reference", "selGenome", "selGroup", "selFeatureGroup", "selTaxon", "selFasta"],
    },
    "tblastn": {
      "valid_databases": ["bacteria-archaea", "viral-reference", "selGenome", "selGroup", "selFeatureGroup", "selTaxon", "selFasta"],
    },
  },
};

const formSchema = z.object({
  input_type: z.enum(["aa", "dna"]),
  input_source: z.enum(["fasta_data", "fasta_file", "feature_group"]),
  db_type: z.enum(["fna", "ffn", "faa", "frn"]),
  db_source: z.enum(["precomputed_database", "genome_list", "genome_group", "feature_group", "taxon_list", "fasta_file"]),
  blast_program: z.enum(["blastn", "blastp", "blastx", "tblastn"]),
  output_file: z.string(),
  output_path: z.string(),
  blast_max_hits: z.number().refine((val) => [1, 10, 20, 50, 100, 500, 5000].includes(val), {
    message: "blast_max_hits must be one of: 1, 10, 20, 50, 100, 500, 5000"
  }),
  blast_evalue_cutoff: z.number().refine((val) => [0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000].includes(val), {
    message: "blast_evalue_cutoff must be one of: 0.0001, 0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000"
  }),
  input_fasta_file: z.string(),
  db_precomputed_database: z.enum(["bacteria-archaea", "viral-reference", "selGenome", "selGroup", "selFeatureGroup", "selTaxon", "selFasta"]),
});

export default function BlastServicePage() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      input_type: "aa",
      input_source: "fasta_data",
      db_type: "fna",
      db_source: "precomputed_database",
      blast_program: "blastn",
      output_file: "",
      output_path: "",
      blast_max_hits: 10,
      blast_evalue_cutoff: 0.0001,
      input_fasta_file: "",
      db_precomputed_database: "bacteria-archaea",
    },
  });

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
              className="service-radio-group-grid"
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
                title={blastServiceInputSource.title}
                description={blastServiceInputSource.description}
                sections={blastServiceInputSource.sections}
              />
            </CardTitle>
          </CardHeader>

          <CardContent className="service-card-content">
            <div className="space-y-4">
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

              <div className={queryType === "enterSequence" ? "service-card-content-grid-item" : "hidden"}>
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

              <div className={queryType === "selectFasta" ? "service-card-content-grid-item" : "hidden"}>
                {/* <Label className="service-card-label">Select FASTA File</Label> */}
                <WorkspaceObjectSelector
                  types={["feature_protein_fasta", "feature_dna_fasta"]}
                  placeholder="Search for FASTA files..."
                  onObjectSelect={(object) => {
                    console.log("Selected FASTA file:", object);
                    // TODO: Update form state
                  }}
                />
              </div>

              <div className={queryType === "selectFeature" ? "service-card-content-grid-item mb-4" : "hidden"}>
                {/* <Label className="service-card-label">Select Feature Group</Label> */}
                <WorkspaceObjectSelector
                  types={["feature_group"]}
                  placeholder="Search for feature groups..."
                  onObjectSelect={(object) => {
                    console.log("Selected feature group:", object);
                    // TODO: Update form state
                  }}
                />
              </div>
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
                  <SelectTrigger className="service-card-select-trigger">
                    <SelectValue placeholder="Select database source" />
                  </SelectTrigger>
                  {/* TODO: Conditionally render based on query type */}
                  <SelectContent className="service-card-select-content">
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

            <div className="service-card-row">
              <div className="service-card-row-item">
                <OutputFolder onChange={setOutputFolder} />
              </div>
              <div className="service-card-row-item">
                <OutputFolder variant="name" onChange={setOutputName} />
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
      </form>
    </section>
  );
}
