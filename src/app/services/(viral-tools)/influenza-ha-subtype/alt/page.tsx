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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Info,
  Upload,
  FileText,
  ArrowRight,
  X,
  HelpCircle,
  FileCode,
  Download,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Copy,
  ChevronRight,
  UploadCloud,
  Tag,
  FileType2,
  Dna,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function HASubtypeNumberingCreative() {
  // States for the form
  const [activeTab, setActiveTab] = useState("input");
  const [inputMethod, setInputMethod] = useState("paste");
  const [inputSequence, setInputSequence] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [outputFolder, setOutputFolder] = useState("");
  const [outputName, setOutputName] = useState("");
  const [selectedScheme, setSelectedScheme] = useState("H1PDM34");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const handleSubmit = () => {
    setIsProcessing(true);

    // Simulate processing
    setTimeout(() => {
      setIsProcessing(false);
      setIsComplete(true);
    }, 3000);
  };

  const handleReset = () => {
    setInputSequence("");
    setSelectedFile(null);
    setOutputFolder("");
    setOutputName("");
    setSelectedScheme("H1PDM34");
    setActiveTab("input");
    setIsProcessing(false);
    setIsComplete(false);
  };

  // Schemes with description for more informative UI
  const schemes = [
    {
      id: "H1PDM34",
      name: "H1PDM34",
      description: "H1 Pandemic 2009 (A/California/04/2009)",
    },
    { id: "H1PR834", name: "H1PR834", description: "H1 A/Puerto Rico/8/34" },
    { id: "H3post1968", name: "H3post1968", description: "H3 (post-1968)" },
    {
      id: "H5Haedin",
      name: "H5Haedin",
      description: "H5 Highly Pathogenic (A/Vietnam/1203/2004)",
    },
    { id: "H2", name: "H2", description: "H2 subtype" },
    { id: "H3", name: "H3", description: "H3 subtype" },
    { id: "H4", name: "H4", description: "H4 subtype" },
    {
      id: "H5GAlamoaGsGD",
      name: "H5GAlamoaGsGD",
      description: "H5 Guangdong lineage",
    },
    { id: "H5", name: "H5", description: "H5 subtype (general)" },
    { id: "H5c221", name: "H5c221", description: "H5 clade 2.2.1" },
  ];

  // Example input sequence
  const exampleSequence = `>A/California/04/2009|H1N1
MKAILVVLLYTFTTANADTLCIGYHANNSTDTVDTVLEKNVTVTHSVNLLEDKHNGKLCKLRGVAPLHLGKCNIAGWILGNPECESLSTASSWSYIVETPSSDNGTCYPGDFIDYEELREQLSSVSSFERFEIFPKTSSWPNHDSNKGVTAACPHAGAKSFYKNLIWLVKKGNSYPKLSKSYINDKGKEVLVLWGIHHPSTSADQQSLYQNADAYVFVGSSRYSKKFKPEIAIRPKVRDQEGRMNYYWTLVEPGDKITFEATGNLVVPRYAFAMERNAGSGIIISDTPVHDCNTTCQTPKGAINTSLPFQNIHPITIGKCPKYVKSTKLRLATGLRNIPSIQSRGLFGAIAGFIEGGWTGMVDGWYGYHHQNEQGSGYAADLKSTQNAIDEITNKVNSVIEKMNTQFTAVGKEFNHLEKRIENLNKKVDDGFLDIWTYNAELLVLLENERTLDYHDSNVKNLYEKVRSQLKNNAKEIGNGCFEFYHKCDNTCMESVKNGTYDYPKYSEEAKLNREEIDGVKLESTRIYQILAIYSTVASSLVLVVSLGAISFWMCSNGSLQCRICI`;

  const sampleOutput = `
H1PDM34 Numbering for A/California/04/2009|H1N1:

Signal Peptide:
1   2   3   4   5   6   7   8   9   10  11  12  13  14  15  16  17
M   K   A   I   L   V   V   L   L   Y   T   F   T   T   A   N   A

HA1:
-    1   2   3   4   5   6   7   8   9   10  11  12  13  14  15
D    T   L   C   I   G   Y   H   A   N   N   S   T   D   T   V
16   17  18  19  20  21  22  23  24  25  26  27  28  29  30  31
D    T   V   L   E   K   N   V   T   V   T   H   S   V   N   L
...

HA2:
1    2   3   4   5   6   7   8   9   10  11  12  13  14  15  16
G    L   F   G   A   I   A   G   F   I   E   G   G   W   T   G
...`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-700 to-indigo-800 py-6 text-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white/20 p-2">
                <Dna className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  HA Subtype Numbering Conversion
                </h1>
                <p className="text-sm text-blue-100">
                  Standardize influenza HA sequence positions
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="border-none bg-white/20 text-white transition-colors hover:bg-white/30">
                <a href="#" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Reference Guide</span>
                </a>
              </Badge>
              <Badge className="border-none bg-white/20 text-white transition-colors hover:bg-white/30">
                <a href="#" className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  <span>Tutorial</span>
                </a>
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8">
        {!isProcessing && !isComplete ? (
          <>
            <div className="mb-8">
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700">
                  This tool renumbers Influenza HA sequences according to the
                  Burke and Smith (2014) cross-subtype numbering scheme,
                  allowing consistent position references across different HA
                  subtypes based on structural and functional equivalence.
                </AlertDescription>
              </Alert>
            </div>

            <Tabs
              defaultValue={activeTab}
              className="w-full"
              onValueChange={setActiveTab}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger
                  value="input"
                  className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                >
                  <FileCode className="mr-2 h-4 w-4" />
                  Input Sequence
                </TabsTrigger>
                <TabsTrigger
                  value="scheme"
                  className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                >
                  <Tag className="mr-2 h-4 w-4" />
                  Numbering Scheme
                </TabsTrigger>
                <TabsTrigger
                  value="output"
                  className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                >
                  <FileType2 className="mr-2 h-4 w-4" />
                  Output Settings
                </TabsTrigger>
              </TabsList>

              {/* Input Sequence Tab */}
              <TabsContent value="input" className="mt-6">
                <Card className="border-none shadow-md">
                  <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                      <FileCode className="h-5 w-5 text-blue-600" />
                      Input Sequence
                    </CardTitle>
                    <CardDescription>
                      Provide the HA protein sequence(s) for renumbering
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-6 pb-6">
                    <div className="space-y-6">
                      <div className="flex gap-4 rounded-lg bg-gray-50 p-2">
                        <Button
                          variant={
                            inputMethod === "paste" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setInputMethod("paste")}
                          className={
                            inputMethod === "paste" ? "bg-blue-600" : ""
                          }
                        >
                          Paste Sequence
                        </Button>
                        <Button
                          variant={
                            inputMethod === "upload" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setInputMethod("upload")}
                          className={
                            inputMethod === "upload" ? "bg-blue-600" : ""
                          }
                        >
                          Upload FASTA
                        </Button>
                        <Button
                          variant={
                            inputMethod === "example" ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => {
                            setInputMethod("example");
                            setInputSequence(exampleSequence);
                          }}
                          className={
                            inputMethod === "example" ? "bg-blue-600" : ""
                          }
                        >
                          Use Example
                        </Button>
                      </div>

                      {inputMethod === "paste" && (
                        <div>
                          <Label
                            htmlFor="sequence"
                            className="mb-2 block text-sm text-gray-600"
                          >
                            Enter one or more protein sequences in FASTA format
                          </Label>
                          <Textarea
                            id="sequence"
                            placeholder="Enter protein sequence in FASTA format, with a header line starting with '>' followed by sequence lines..."
                            className="min-h-[240px] font-mono text-sm"
                            value={inputSequence}
                            onChange={(e) => setInputSequence(e.target.value)}
                          />
                        </div>
                      )}

                      {inputMethod === "upload" && (
                        <div className="rounded-lg border-2 border-dashed border-blue-200 p-12 text-center">
                          <div className="flex flex-col items-center">
                            <div className="mb-4 rounded-full bg-blue-100 p-3">
                              <UploadCloud className="h-6 w-6 text-blue-600" />
                            </div>
                            <h3 className="mb-2 font-medium">
                              Upload FASTA file
                            </h3>
                            <p className="mb-6 max-w-md text-sm text-gray-500">
                              Select a FASTA format file containing one or more
                              HA protein sequences
                            </p>
                            <Button
                              variant="outline"
                              className="flex items-center gap-2"
                              onClick={() => {
                                // Would trigger file upload in real implementation
                                setSelectedFile("example_ha_sequences.fasta");
                              }}
                            >
                              <Upload className="h-4 w-4" />
                              Browse Files
                            </Button>

                            {selectedFile && (
                              <div className="mt-4 flex items-center gap-2 rounded-md bg-blue-50 p-2 text-sm">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span className="font-medium">
                                  {selectedFile}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="ml-2 h-6 w-6"
                                  onClick={() => setSelectedFile(null)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {inputMethod === "example" && (
                        <div>
                          <Label className="mb-2 block text-sm text-gray-600">
                            Example sequence: A/California/04/2009 (H1N1)
                          </Label>
                          <div className="relative">
                            <Textarea
                              value={exampleSequence}
                              readOnly
                              className="min-h-[240px] bg-gray-50 font-mono text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="absolute top-2 right-2 flex h-7 items-center gap-1.5"
                              onClick={() => {
                                navigator.clipboard.writeText(exampleSequence);
                                // Would show a toast in real implementation
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="text-xs">Copy</span>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="flex justify-between border-t bg-gray-50 pt-2">
                    <div></div>
                    <Button
                      onClick={() => setActiveTab("scheme")}
                      disabled={!inputSequence && !selectedFile}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Continue to Numbering Scheme
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Numbering Scheme Tab */}
              <TabsContent value="scheme" className="mt-6">
                <Card className="border-none shadow-md">
                  <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                      <Tag className="h-5 w-5 text-blue-600" />
                      Select Numbering Scheme
                    </CardTitle>
                    <CardDescription>
                      Choose the HA numbering scheme to apply to your
                      sequence(s)
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-6 pb-6">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {schemes.map((scheme) => (
                        <div
                          key={scheme.id}
                          className={`cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                            selectedScheme === scheme.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                          onClick={() => setSelectedScheme(scheme.id)}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={selectedScheme === scheme.id}
                              className="mt-0.5"
                            />
                            <div>
                              <p className="font-medium">{scheme.name}</p>
                              <p className="text-sm text-gray-600">
                                {scheme.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 rounded-lg bg-blue-50 p-4">
                      <div className="flex items-start gap-3">
                        <Info className="mt-0.5 h-5 w-5 text-blue-600" />
                        <div>
                          <h4 className="font-medium text-blue-800">
                            About the Burke & Smith Numbering System
                          </h4>
                          <p className="mt-1 text-sm text-blue-700">
                            This numbering system allows consistent position
                            references across different HA subtypes based on
                            structural and functional equivalence, enabling
                            comparative analyses and consistent mutation
                            descriptions across different influenza subtypes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="flex justify-between border-t bg-gray-50 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("input")}
                    >
                      Back to Input
                    </Button>
                    <Button
                      onClick={() => setActiveTab("output")}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Continue to Output Settings
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              {/* Output Settings Tab */}
              <TabsContent value="output" className="mt-6">
                <Card className="border-none shadow-md">
                  <CardHeader className="rounded-t-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
                      <FileType2 className="h-5 w-5 text-blue-600" />
                      Output Settings
                    </CardTitle>
                    <CardDescription>
                      Configure how results will be saved and formatted
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="pt-6 pb-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-4">
                        <div>
                          <Label>Output Format</Label>
                          <Select defaultValue="text">
                            <SelectTrigger>
                              <SelectValue placeholder="Select output format" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">
                                Text (Position Table)
                              </SelectItem>
                              <SelectItem value="fasta">
                                FASTA (With Position Annotations)
                              </SelectItem>
                              <SelectItem value="csv">
                                CSV (Spreadsheet Compatible)
                              </SelectItem>
                              <SelectItem value="json">JSON</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="mt-1 text-xs text-gray-500">
                            How the renumbered sequence data should be formatted
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label>Output Folder</Label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="/path/to/output"
                              value={outputFolder}
                              onChange={(e) => setOutputFolder(e.target.value)}
                              className="flex-1"
                            />
                            <Button variant="outline" size="icon">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500">
                            Directory where output files will be saved
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Output Filename</Label>
                          <Input
                            placeholder="ha_numbering_results"
                            value={outputName}
                            onChange={(e) => setOutputName(e.target.value)}
                          />
                          <p className="text-xs text-gray-500">
                            Base name for output files (extension will be added
                            based on format)
                          </p>
                        </div>

                        <div className="mt-4 space-y-3">
                          <Label>Additional Options</Label>
                          <div className="flex items-center gap-2">
                            <Checkbox id="include-original" />
                            <Label
                              htmlFor="include-original"
                              className="text-sm font-normal"
                            >
                              Include original sequence positions
                            </Label>
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox id="highlight-conserved" defaultChecked />
                            <Label
                              htmlFor="highlight-conserved"
                              className="text-sm font-normal"
                            >
                              Highlight conserved amino acids
                            </Label>
                          </div>

                          <div className="flex items-center gap-2">
                            <Checkbox id="segment-domains" defaultChecked />
                            <Label
                              htmlFor="segment-domains"
                              className="text-sm font-normal"
                            >
                              Separate HA1 and HA2 domains
                            </Label>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Alert className="border-blue-100 bg-blue-50">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-700">
                          The renumbering process will preserve your original
                          sequence data while assigning new position numbers
                          according to the selected scheme. This facilitates
                          comparison across different HA subtypes.
                        </AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>

                  <CardFooter className="flex justify-between border-t bg-gray-50 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("scheme")}
                    >
                      Back to Numbering Scheme
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Run Analysis
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : isProcessing ? (
          <div className="mx-auto mt-8 max-w-2xl rounded-lg border bg-white p-8 text-center shadow-sm">
            <div className="space-y-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Dna className="h-8 w-8 animate-pulse text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Processing Your Sequence
              </h2>
              <p className="mx-auto max-w-md text-gray-500">
                Please wait while we analyze and renumber your sequence
                according to the {selectedScheme} scheme
              </p>

              <div className="mx-auto max-w-md">
                <div className="mb-2 flex justify-between text-sm">
                  <span>Analyzing sequence structure</span>
                  <span>62%</span>
                </div>
                <Progress value={62} className="h-2" />
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto mt-8 max-w-3xl rounded-lg border bg-white p-8 shadow-sm">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">
                Renumbering Complete
              </h2>
              <p className="mx-auto mt-2 max-w-md text-gray-500">
                Your sequence has been successfully renumbered using the{" "}
                {selectedScheme} numbering scheme
              </p>
            </div>

            <div className="mb-6 rounded-lg border bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium text-blue-800">Result Preview</h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex h-7 items-center gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="text-xs">Copy</span>
                </Button>
              </div>
              <Textarea
                value={sampleOutput}
                readOnly
                className="min-h-[200px] bg-white font-mono text-sm"
              />
            </div>

            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700">
                <Download className="h-4 w-4" />
                Download Results
              </Button>
              <Button variant="outline" onClick={handleReset}>
                Start New Analysis
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
