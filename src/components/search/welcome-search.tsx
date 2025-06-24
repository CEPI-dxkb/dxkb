"use client";

import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchBar } from "./search-bar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ThemeContent from "@/components/ui/theme-content";

interface WelcomeSearchProps {
  setSearchResults?: (results: any) => void;
}

const WelcomeSearch = ({ setSearchResults }: WelcomeSearchProps) => {
  return (
    <section className="flex-grow">
      {/* Hero Section with Search */}
      <div className="from-primary to-background bg-gradient-to-b py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="mb-4 text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            <ThemeContent type="welcome-title" as="span" />
          </h1>
          <h3 className="mx-auto mb-8 max-w-3xl text-lg font-normal text-white/80">
            <ThemeContent type="welcome-subtitle" as="span" />
          </h3>

          {/* Search Interface */}
          <div className="mx-auto max-w-4xl">
            <div className="bg-card rounded-lg p-6 shadow-lg">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Search</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
                  <TabsTrigger value="sequence">Sequence Search</TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <SearchBar
                    size="lg"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="mr-2 text-sm text-muted-foreground">
                      Popular searches:
                    </span>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-foreground"
                    >
                      SARS-CoV-2
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-foreground"
                    >
                      Influenza A
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-foreground"
                    >
                      HIV-1
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-foreground"
                    >
                      Ebola virus
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="cursor-pointer text-foreground"
                    >
                      Zika virus
                    </Badge>
                  </div>
                </TabsContent>

                <TabsContent value="advanced">
                  <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label className="card-sublabel">
                        Taxonomy
                      </Label>
                      <Input type="text" placeholder="e.g., Coronaviridae" className="card-input" />
                    </div>
                    <div>
                      <Label className="card-sublabel">
                        Host
                      </Label>
                      <Input type="text" placeholder="e.g., Homo sapiens" className="card-input" />
                    </div>
                    <div>
                      <Label className="card-sublabel">
                        Genome Type
                      </Label>
                      <Input type="text" placeholder="e.g., ssRNA(+)" className="card-input" />
                    </div>
                    <div>
                      <Label className="card-sublabel">
                        Protein Function
                      </Label>
                      <Input type="text" placeholder="e.g., Polymerase" className="card-input" />
                    </div>
                  </div>
                  <Button className="bg-secondary hover:bg-secondary-foreground w-full">
                    Submit Advanced Search
                  </Button>
                </TabsContent>

                <TabsContent value="sequence">
                  <div className="mb-4">
                    <RadioGroup defaultValue="nucleotide" className="radio-group">
                      <Label className="card-sublabel">
                        Sequence Type
                      </Label>
                      <div className="radio-group-item-container">
                        <div>
                          <RadioGroupItem
                            id="nucleotide"
                            value="nucleotide"
                          />
                          <Label htmlFor="nucleotide">Nucleotide</Label>
                        </div>
                        <div>
                          <RadioGroupItem
                            id="protein"
                            value="protein"
                          />
                          <Label htmlFor="protein">Protein</Label>
                        </div>
                      </div>
                    </RadioGroup>

                    <div className="gap-4 text-foreground">
                      <Label className="card-sublabel">
                        Enter Sequence
                      </Label>
                      <Textarea
                        className="h-24 w-full rounded-md border m-2 font-mono text-sm text-foreground"
                        placeholder="Paste your sequence here (FASTA format supported)"
                      ></Textarea>
                    </div>
                  </div>
                  <Button className="bg-secondary hover:bg-secondary-foreground w-full">
                    Search by Sequence
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WelcomeSearch;
