import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  quickAccessDefinitions,
  type QuickAccessKey,
} from "@/lib/services/quick-access-statistics";
import type { StatisticCounts } from "@/lib/services/statistics";

import ProteinIcon from "@public/icons/protein.svg";
import SequenceIcon from "@public/icons/sequence.svg";
import GenomeIcon from "@public/icons/genome.svg";
import PartialSeqIcon from "@public/icons/pipeline.svg";
import { Box, Target } from "lucide-react";

const numberFormatter = new Intl.NumberFormat("en-US");

// One source for each label: the definition whose filter produces the count.
const labels = Object.fromEntries(
  quickAccessDefinitions.map((definition) => [definition.key, definition.label]),
) as Record<QuickAccessKey, string>;

interface QuickViralContentProps {
  /** `null` while loading: each badge shows a placeholder. */
  counts: StatisticCounts<QuickAccessKey> | null;
  unavailableReason?: string | null;
}

interface CountRowProps {
  icon: ReactNode;
  statKey: QuickAccessKey;
  counts: StatisticCounts<QuickAccessKey> | null;
}

// A failed count keeps its visible dash, but the dash alone is skipped or read
// as "dash" by screen readers, so it is hidden from them and replaced by text.
const CountValue = ({ count }: { count: number | null }) =>
  count === null ? (
    <>
      <span aria-hidden="true">—</span>
      <span className="sr-only">Count unavailable</span>
    </>
  ) : (
    numberFormatter.format(count)
  );

const CountRow = ({ icon, statKey, counts }: CountRowProps) => {
  return (
    <li className="flex justify-between">
      <div className="flex items-center gap-2">
        {icon}
        <span>{labels[statKey]}</span>
      </div>
      {counts === null ? (
        <Skeleton className="h-5 w-14" />
      ) : (
        <Badge variant="accent">
          <CountValue count={counts[statKey]} />
        </Badge>
      )}
    </li>
  );
};

const QuickViralContent = ({ counts, unavailableReason = null }: QuickViralContentProps) => {
  return (
    <section className="bg-background py-12">
      <div className="container mx-auto px-4">
        <h2 className="mb-8 text-center text-2xl font-bold">Quick Access to Viral Data</h2>

        {unavailableReason !== null ? (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>
              {unavailableReason
                ? `Counts temporarily unavailable: ${unavailableReason}`
                : "Counts temporarily unavailable."}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Viral Genomes</CardTitle>
              <CardDescription>Complete genomic sequences and annotations</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <CountRow icon={<GenomeIcon className="size-4" />} statKey="completeGenomes" counts={counts} />
                <CountRow icon={<PartialSeqIcon className="size-4" />} statKey="partialGenomes" counts={counts} />
                <CountRow icon={<SequenceIcon className="size-4" />} statKey="referenceGenomes" counts={counts} />
              </ul>
              <Button variant="outline" className="mt-4 w-full">
                Browse Genomes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Viral Proteins</CardTitle>
              <CardDescription>Protein structures and epitopes</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <CountRow icon={<Box className="size-4 justify-start" />} statKey="experimentalStructures" counts={counts} />
                <CountRow icon={<ProteinIcon className="size-4" />} statKey="predictedStructures" counts={counts} />
                <CountRow icon={<Target className="size-4" />} statKey="epitopes" counts={counts} />
              </ul>
              <Button variant="outline" className="mt-4 w-full">
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
              <Button variant="outline" className="mt-4 w-full">
                Access Tools
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default QuickViralContent;
