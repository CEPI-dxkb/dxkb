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
import { Label } from "@/components/ui/label";
import { Info, Search, FileDown, Database, Dna, Upload } from "lucide-react";

const GenomeAnnotationContent = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold text-indigo-800">
          Genome Annotation
        </h1>
        <div className="mb-4 flex justify-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-5 w-5 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-md">Genome Annotation Information</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <a href="#" className="text-indigo-600 hover:text-indigo-800">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
        </div>
        <p className="mx-auto max-w-3xl text-gray-600">
          The Genome Annotation Service provides annotation of genomic features
          using the RAST tool kit (RASTtk) for bacteria and VirION for viruses.
          The service accepts a FASTA formatted file and an annotation recipe
          based on taxonomy to provide an annotated genome. For further
          explanation, please see the Genome Annotation Service
          <a href="#" className="mx-1 text-indigo-600 hover:text-indigo-800">
            Quick Reference Guide
          </a>{" "}
          and
          <a href="#" className="ml-1 text-indigo-600 hover:text-indigo-800">
            Tutorial
          </a>
          .
        </p>
      </div>

      <form className="mx-auto max-w-4xl space-y-6">
        {/* Contigs Upload */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Parameters</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">
                      Set parameters for genome annotation
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contigsFile" className="font-medium">
                  CONTIGS
                </Label>
                <div className="flex items-center">
                  <Input id="contigsFile" type="file" className="flex-1" />
                  <Button variant="outline" className="ml-2" size="icon">
                    <FileDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Annotation Recipe */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center">
              <CardTitle className="text-lg">Annotation Recipe</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="ml-2">
                    <Info className="h-4 w-4 text-gray-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-md">
                      Select a recipe for genome annotation
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <Select defaultValue="select">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="--- Select Recipe ---" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="select">--- Select Recipe ---</SelectItem>
                <SelectItem value="bacteria">Bacteria Generic</SelectItem>
                <SelectItem value="archaea">Archaea Generic</SelectItem>
                <SelectItem value="virus">Virus</SelectItem>
                <SelectItem value="bacteriophage">Bacteriophage</SelectItem>
                <SelectItem value="custom">Custom Recipe</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Taxonomy Information */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center">
                <CardTitle className="text-lg">Taxonomy Name</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-md">Enter the taxonomy name</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Input placeholder="e.g. Bacillus cereus" className="flex-1" />
                <Button variant="outline" className="ml-2" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center">
                <CardTitle className="text-lg">Taxonomy ID</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="ml-2">
                      <Info className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-md">Enter a taxonomy ID (optional)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              <Input placeholder="Taxonomy ID (optional)" />
            </CardContent>
          </Card>
        </div>

        {/* My Label */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">My Label</CardTitle>
          </CardHeader>
          <CardContent>
            <Input placeholder="My identifier123" />
          </CardContent>
        </Card>

        {/* Output Options */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Output Name</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                placeholder="Taxonomy + My Label"
                defaultValue="Taxonomy + My Label"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Output Folder</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center">
                <Input
                  placeholder="Select an output folder"
                  className="flex-1"
                />
                <Button variant="outline" className="ml-2" size="icon">
                  <FileDown className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-center space-x-4 pt-4">
          <Button variant="outline" type="reset">
            Reset
          </Button>
          <Button type="submit">Annotate</Button>
        </div>
      </form>
    </div>
  );
};

export default GenomeAnnotationContent;
