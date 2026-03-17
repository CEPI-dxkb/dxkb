import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import ProteinIcon from "@public/icons/protein.svg";
import EnzymeIcon from "@public/icons/enzyme.svg";
import SequenceIcon from "@public/icons/sequence.svg";
import GenomeIcon from "@public/icons/genome.svg";
import PartialSeqIcon from "@public/icons/pipeline.svg";
import { Box } from "lucide-react";

const QuickViralLinks = () => {
  return (
    <section className="py-12 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold mb-8 text-center">Quick Access to Viral Data</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Viral Genomes</CardTitle>
              <CardDescription>Complete genomic sequences and annotations</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <div className="flex items-center gap-2">
                    {/* <Image src={GenomeIcon} alt="Genome" width={16} height={16} className="fill-accent"/> */}
                    <GenomeIcon className="w-4 h-4" />
                    <span>Complete Genomes</span>
                  </div>
                  <Badge className="bg-accent text-foreground">24,891</Badge>
                </li>
                <li className="flex justify-between">
                  <div className="flex items-center gap-2">
                    {/* <Image src={PartialSeqIcon} alt="Partial Sequence" width={16} height={16} /> */}
                    <PartialSeqIcon className="w-4 h-4" />
                    <span>Partial Sequences</span>
                  </div>
                  <Badge className="bg-accent text-foreground">103,457</Badge>
                </li>
                <li className="flex justify-between">
                  <div className="flex items-center gap-2">
                    {/* <Image src={SequenceIcon} alt="Sequence" width={16} height={16} /> */}
                    <SequenceIcon className="w-4 h-4" />
                    <span>Reference Sequences</span>
                  </div>
                  <Badge className="bg-accent text-foreground">1,204</Badge>
                </li>
              </ul>
              <Button variant="outline" className="w-full mt-4">
                Browse Genomes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Viral Proteins</CardTitle>
              <CardDescription>Structural and functional protein data</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <div className="flex items-center gap-2">
                    {/* <Image src={ProteinIcon} alt="Protein" width={16} height={16} /> */}
                    <ProteinIcon className="w-4 h-4" />
                    <span>Structural Proteins</span>
                  </div>
                  <Badge className="bg-accent text-foreground">18,742</Badge>
                </li>
                <li className="flex justify-between">
                  <div className="flex items-center gap-2">
                    {/* <Image src={EnzymeIcon} alt="Enzyme" width={16} height={16} /> */}
                    <EnzymeIcon className="w-4 h-4" />
                    <span>Enzymes</span>
                  </div>
                  <Badge className="bg-accent text-foreground">31,205</Badge>
                </li>
                <li className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <Box className="justify-start w-4 h-4" />
                    <span>3D Structures</span>
                  </div>
                  <Badge className="bg-accent text-foreground [data-theme='dxkb-dark']:text-black">5,891</Badge>
                </li>
              </ul>
              <Button variant="outline" className="w-full mt-4">
                Browse Proteins
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Analysis Tools</CardTitle>
              <CardDescription>Specialized tools for viral research</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M2 12h20" />
                    <path d="M2 12v8a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-8" />
                    <path d="M2 12v-8a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v8" />
                    <path d="M12 7v10" />
                    <path d="M7 12h10" />
                  </svg>
                  <span>Sequence Alignment</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 3v18h18" />
                    <path d="m19 9-5 5-4-4-3 3" />
                  </svg>
                  <span>Phylogenetic Analysis</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="m4.93 4.93 4.24 4.24" />
                    <path d="m14.83 9.17 4.24-4.24" />
                    <path d="m14.83 14.83 4.24 4.24" />
                    <path d="m9.17 14.83-4.24 4.24" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  <span>Protein Structure Prediction</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full mt-4">
                Access Tools
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

export default QuickViralLinks;