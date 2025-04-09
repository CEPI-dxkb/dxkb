"use client";

import { ExternalLink, Download, BarChart } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Citation } from "../data/types";

interface CitationCardProps {
  citation: Citation;
}

export function CitationCard({ citation }: CitationCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="citation-card">
          <div className="citation-card-header">
            <div className="citation-card-badges">
              <Badge variant="outline">{citation.year}</Badge>
              <Badge variant="secondary">{citation.type}</Badge>
            </div>
            <div className="citation-card-badges">
              <Badge variant="outline" className="flex items-center gap-1">
                <BarChart className="h-3 w-3" />
                IF: {citation.impactFactor.toFixed(1)}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                {citation.citationCount} citations
              </Badge>
            </div>
          </div>

          <div>
            <Link
              href={citation.doi}
              target="_blank"
              className="citation-card-title"
            >
              {citation.title}
              <ExternalLink className="h-4 w-4 inline-block ml-1" />
            </Link>
            <p className="citation-card-meta">{citation.authors}</p>
            <p className="citation-card-journal">{citation.journal}</p>
          </div>

          <p className="citation-card-abstract">{citation.abstract}</p>

          <div className="citation-card-actions">
            <Button variant="outline" size="sm" asChild>
              <a href={citation.doi} target="_blank" rel="noopener noreferrer">
                View Paper
              </a>
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export Citation
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 