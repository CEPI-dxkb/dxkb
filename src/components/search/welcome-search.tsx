import React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LuSearch } from "react-icons/lu";


const WelcomeSearch = () => {
  return (
    <section className="flex-grow">
      {/* Hero Section with Search */}
      <div className="bg-gradient-to-b from-primary-def to-background-50 py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
            Welcome to the Disease X Knowledge Base
          </h1>
          <p className="text-gray-50 max-w-3xl mx-auto mb-8 text-lg font-normal">
            Access detailed information on viral genomes, proteins, and biological data to accelerate your research
            and discoveries.
          </p>

          {/* Search Interface */}
          <div className="max-w-4xl mx-auto">
            <div className="bg-background-50 rounded-lg shadow-lg p-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="basic">Basic Search</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced Search</TabsTrigger>
                  <TabsTrigger value="sequence">Sequence Search</TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <div className="flex gap-2">
                    <div className="relative flex-grow">
                      <Input
                        type="text"
                        placeholder="Search by virus name, protein, gene, or taxonomy..."
                        className="pl-10 py-6"
                      />
                      <LuSearch
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        size={18}
                      />
                    </div>
                    <Button size="lg" className="bg-secondary-def hover:bg-secondary-def">
                      Search
                    </Button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="text-sm text-gray-500 mr-2">Popular searches:</span>
                    <Badge variant="secondary" className="cursor-pointer text-white">
                      SARS-CoV-2
                    </Badge>
                    <Badge variant="secondary" className="cursor-pointer text-white">
                      Influenza A
                    </Badge>
                    <Badge variant="secondary" className="cursor-pointer text-white">
                      HIV-1
                    </Badge>
                    <Badge variant="secondary" className="cursor-pointer text-white">
                      Ebola virus
                    </Badge>
                    <Badge variant="secondary" className="cursor-pointer text-white">
                      Zika virus
                    </Badge>
                  </div>
                </TabsContent>

                <TabsContent value="advanced">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Taxonomy</label>
                      <Input type="text" placeholder="e.g., Coronaviridae" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Host</label>
                      <Input type="text" placeholder="e.g., Homo sapiens" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Genome Type</label>
                      <Input type="text" placeholder="e.g., ssRNA(+)" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">
                        Protein Function
                      </label>
                      <Input type="text" placeholder="e.g., Polymerase" />
                    </div>
                  </div>
                  <Button className="w-full bg-secondary-def hover:bg-secondary-def">Submit Advanced Search</Button>
                </TabsContent>

                <TabsContent value="sequence">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Sequence Type</label>
                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center">
                        <input type="radio" id="nucleotide" name="sequence-type" className="mr-2" defaultChecked />
                        <label htmlFor="nucleotide">Nucleotide</label>
                      </div>
                      <div className="flex items-center">
                        <input type="radio" id="protein" name="sequence-type" className="mr-2" />
                        <label htmlFor="protein">Protein</label>
                      </div>
                    </div>

                    <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Enter Sequence</label>
                    <textarea
                      className="w-full border rounded-md p-2 h-24 text-sm font-mono"
                      placeholder="Paste your sequence here (FASTA format supported)"
                    ></textarea>
                  </div>
                  <Button className="w-full bg-secondary-def hover:bg-secondary-def">Search by Sequence</Button>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default WelcomeSearch;
