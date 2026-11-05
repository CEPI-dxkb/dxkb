"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  ServiceCardHeader,
  ServiceCardContent,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import { rqlEq, rqlAnd, escapeRqlValue } from "@/lib/views/rql";
import { genomeListHref } from "@/lib/views/hrefs";

function rqlBetween(field: string, from: string, to: string): string {
  if (from && to) return `and(ge(${field},${escapeRqlValue(from)}),le(${field},${escapeRqlValue(to)}))`;
  if (from) return `ge(${field},${escapeRqlValue(from)})`;
  return `le(${field},${escapeRqlValue(to)})`;
}

export function GenomeSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [genomeId, setGenomeId] = useState("");
  const [genomeName, setGenomeName] = useState("");
  const [taxonName, setTaxonName] = useState("");
  const [hostName, setHostName] = useState("");
  const [isolationCountry, setIsolationCountry] = useState("");
  const [collectionDateFrom, setCollectionDateFrom] = useState("");
  const [collectionDateTo, setCollectionDateTo] = useState("");
  const [genomeLengthFrom, setGenomeLengthFrom] = useState("");
  const [genomeLengthTo, setGenomeLengthTo] = useState("");
  const [completeOnly, setCompleteOnly] = useState(false);

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (genomeId.trim()) clauses.push(rqlEq("genome_id", genomeId.trim()));
    if (genomeName.trim()) clauses.push(rqlEq("genome_name", genomeName.trim()));
    if (taxonName.trim()) clauses.push(rqlEq("taxon_lineage_names", taxonName.trim()));
    if (hostName.trim()) clauses.push(rqlEq("host_name", hostName.trim()));
    if (isolationCountry.trim()) clauses.push(rqlEq("isolation_country", isolationCountry.trim()));
    if (completeOnly) clauses.push(rqlEq("genome_status", "Complete"));
    if (collectionDateFrom.trim() || collectionDateTo.trim()) {
      clauses.push(rqlBetween("collection_date", collectionDateFrom.trim(), collectionDateTo.trim()));
    }
    if (genomeLengthFrom.trim() || genomeLengthTo.trim()) {
      clauses.push(rqlBetween("genome_length", genomeLengthFrom.trim(), genomeLengthTo.trim()));
    }

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    router.push(genomeListHref({ rql, keyword: keyword.trim() || undefined }));
  };

  const handleReset = () => {
    setKeyword("");
    setGenomeId("");
    setGenomeName("");
    setTaxonName("");
    setHostName("");
    setIsolationCountry("");
    setCollectionDateFrom("");
    setCollectionDateTo("");
    setGenomeLengthFrom("");
    setGenomeLengthTo("");
    setCompleteOnly(false);
  };

  return (
    <form onSubmit={handleSubmit} onReset={handleReset} className="space-y-6">
      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Keyword</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-row-item">
            <ServiceLabel htmlFor="keyword">Keyword</ServiceLabel>
            <ServiceInput
              id="keyword"
              placeholder="Search term"
              value={keyword}
              onChange={(e) => { setKeyword(e.target.value); }}
            />
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Pathogen / Genome</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="taxon-name">Taxon Name</ServiceLabel>
              <ServiceInput
                id="taxon-name"
                placeholder="e.g. Influenza A virus"
                value={taxonName}
                onChange={(e) => { setTaxonName(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="genome-id">Genome ID</ServiceLabel>
              <ServiceInput
                id="genome-id"
                placeholder="e.g. 1332244.20"
                value={genomeId}
                onChange={(e) => { setGenomeId(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="genome-name">Genome Name</ServiceLabel>
              <ServiceInput
                id="genome-name"
                placeholder="e.g. Influenza A virus (A/Shanghai/02/2013(H7N9))"
                value={genomeName}
                onChange={(e) => { setGenomeName(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="host-name">Host Name</ServiceLabel>
              <ServiceInput
                id="host-name"
                placeholder="e.g. Homo sapiens"
                value={hostName}
                onChange={(e) => { setHostName(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="isolation-country">Isolation Country</ServiceLabel>
              <ServiceInput
                id="isolation-country"
                placeholder="e.g. China"
                value={isolationCountry}
                onChange={(e) => { setIsolationCountry(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Collection Date</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="date-from">From</ServiceLabel>
              <ServiceInput
                id="date-from"
                placeholder="YYYY or YYYY-MM or YYYY-MM-DD"
                value={collectionDateFrom}
                onChange={(e) => { setCollectionDateFrom(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="date-to">To</ServiceLabel>
              <ServiceInput
                id="date-to"
                placeholder="YYYY or YYYY-MM or YYYY-MM-DD"
                value={collectionDateTo}
                onChange={(e) => { setCollectionDateTo(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Genome Length</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="length-from">From (bp)</ServiceLabel>
              <ServiceInput
                id="length-from"
                type="number"
                min={0}
                placeholder="e.g. 10000"
                value={genomeLengthFrom}
                onChange={(e) => { setGenomeLengthFrom(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="length-to">To (bp)</ServiceLabel>
              <ServiceInput
                id="length-to"
                type="number"
                min={0}
                placeholder="e.g. 50000"
                value={genomeLengthTo}
                onChange={(e) => { setGenomeLengthTo(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Checkbox
          id="complete-only"
          checked={completeOnly}
          onCheckedChange={setCompleteOnly}
        />
        <Label htmlFor="complete-only">Complete genomes only</Label>
      </div>

      <div className="service-form-controls">
        <Button type="reset" variant="outline">Reset</Button>
        <Button type="submit" variant="cta">Search</Button>
      </div>
    </form>
  );
}
