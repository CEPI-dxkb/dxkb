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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Info,
  FileDown,
  Search,
  Dna,
  ExternalLink,
  Database,
  BarChart4,
} from "lucide-react";

const SimilarGenomeFinderInterface = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-indigo-800">
          Similar Genome Finder
        </h1>
        <div className="mb-4 flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">
                  Find similar genomes using sequence comparison
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a href="#" className="text-indigo-600 hover:text-indigo-800">
            <ExternalLink className="h-5 w-5" />
          </a>
          <a href="#" className="text-indigo-600 hover:text-indigo-800">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
          </a>
        </div>
        <p className="max-w-4xl text-gray-600">
          The Similar Genome Finder Service will find similar public genomes in
          BV-BRC or compute genome distance estimation using Mash/MinHash. It
          returns a set of genomes matching the specified similarity criteria.
          <a
            href="#"
            className="mx-1 inline-flex items-center text-indigo-600 hover:text-indigo-800"
          >
            <svg
              className="mr-1 h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Link to Mash/MinHash
          </a>
          . For further explanation, please see the Similar Genome Finder
          Service
          <a href="#" className="mx-1 text-indigo-600 hover:text-indigo-800">
            Quick Reference Guide
          </a>
          ,
          <a href="#" className="mx-1 text-indigo-600 hover:text-indigo-800">
            Tutorial
          </a>{" "}
          and
          <a href="#" className="ml-1 text-indigo-600 hover:text-indigo-800">
            Instructional Video
          </a>
          .
        </p>
      </div>

      <form className="mx-auto max-w-4xl space-y-6">
        {/* Select a Genome Section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Select a Genome</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">
                      Choose a genome to find similar matches
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center">
                <Label className="font-medium text-gray-700">
                  SEARCH BY GENOME NAME OR GENOME ID
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Enter a genome name or ID to search</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex space-x-2">
                <Input
                  placeholder="e.g. Mycobacterium tuberculosis H37Rv"
                  className="flex-1"
                />
                <Button variant="outline" className="flex-shrink-0">
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium text-gray-700">
                OR UPLOAD FASTA/READS
              </Label>
              <div className="flex space-x-2">
                <Input type="file" className="flex-1" />
                <Button variant="outline" className="ml-2" size="icon">
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Parameters Section */}
        <Accordion
          type="single"
          collapsible
          className="w-full"
          defaultValue="parameters"
        >
          <AccordionItem value="parameters">
            <AccordionTrigger className="rounded-md bg-gray-100 px-4 py-3 text-lg font-semibold">
              Parameters
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label className="font-medium text-gray-700">
                          MAX HITS
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="ml-2">
                              <Info className="h-4 w-4 text-gray-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Maximum number of similar genomes to return</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select defaultValue="50">
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="50" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center">
                        <Label className="font-medium text-gray-700">
                          P-VALUE THRESHOLD
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="ml-2">
                              <Info className="h-4 w-4 text-gray-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Statistical significance threshold</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select defaultValue="1">
                        <SelectTrigger className="w-full">
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
                      <div className="flex items-center">
                        <Label className="font-medium text-gray-700">
                          DISTANCE
                        </Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="ml-2">
                              <Info className="h-4 w-4 text-gray-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Maximum Mash distance to include</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select defaultValue="1">
                        <SelectTrigger className="w-full">
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

                    <div className="space-y-2">
                      <Label className="font-medium text-gray-700">
                        ORGANISM TYPE
                      </Label>
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center space-x-2">
                          <Checkbox id="bacteria" defaultChecked />
                          <Label
                            htmlFor="bacteria"
                            className="text-sm font-normal"
                          >
                            BACTERIAL AND ARCHAEAL GENOMES
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="viral" />
                          <Label
                            htmlFor="viral"
                            className="text-sm font-normal"
                          >
                            VIRAL GENOMES
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="reference" />
                          <Label
                            htmlFor="reference"
                            className="text-sm font-normal"
                          >
                            REFERENCE AND REPRESENTATIVE GENOMES
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox id="all" />
                          <Label htmlFor="all" className="text-sm font-normal">
                            ALL PUBLIC GENOMES
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Submit Button */}
        <div className="flex justify-center pt-4">
          <Button
            type="submit"
            className="bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Search className="mr-2 h-4 w-4" />
            Search
          </Button>
        </div>
      </form>

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
    </div>
  );
};

export default SimilarGenomeFinderInterface;
