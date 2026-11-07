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
import { KeywordCard, PathogenCard } from "./advanced-search-fields";
import { rqlEq, rqlAnd } from "@/lib/views/rql";
import { encodeQueryComponent } from "@/lib/url";

const assayResultOptions = ["Positive", "Negative"] as const;

export function EpitopeSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [taxonName, setTaxonName] = useState("");
  const [epitopeId, setEpitopeId] = useState("");
  const [epitopeType, setEpitopeType] = useState("");
  const [epitopeSequence, setEpitopeSequence] = useState("");
  const [proteinName, setProteinName] = useState("");
  const [proteinAccession, setProteinAccession] = useState("");
  const [assayResults, setAssayResults] = useState<Set<string>>(new Set());

  const toggleAssayResult = (value: string) => {
    setAssayResults((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (taxonName.trim()) clauses.push(rqlEq("organism", taxonName.trim()));
    if (epitopeId.trim()) clauses.push(rqlEq("epitope_id", epitopeId.trim()));
    if (epitopeType.trim()) clauses.push(rqlEq("epitope_type", epitopeType.trim()));
    if (epitopeSequence.trim()) clauses.push(rqlEq("epitope_sequence", epitopeSequence.trim()));
    if (proteinName.trim()) clauses.push(rqlEq("protein_name", proteinName.trim()));
    if (proteinAccession.trim()) clauses.push(rqlEq("protein_accession", proteinAccession.trim()));
    if (assayResults.size > 0) {
      const assayClauses = [...assayResults].map((v) => rqlEq("assay_results", v));
      clauses.push(assayClauses.length === 1 ? assayClauses[0] : `or(${assayClauses.join(",")})`);
    }

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params: string[] = [];
    if (rql) params.push(`rql=${encodeQueryComponent(rql)}`);
    if (keyword.trim()) params.push(`keyword=${encodeQueryComponent(keyword.trim())}`);
    router.push(params.length ? `/epitope?${params.join("&")}` : "/epitope");
  };

  const handleReset = () => {
    setKeyword("");
    setTaxonName("");
    setEpitopeId("");
    setEpitopeType("");
    setEpitopeSequence("");
    setProteinName("");
    setProteinAccession("");
    setAssayResults(new Set());
  };

  return (
    <form onSubmit={handleSubmit} onReset={handleReset} className="space-y-6">
      <KeywordCard value={keyword} onChange={setKeyword} />

      <PathogenCard value={taxonName} onChange={setTaxonName} />

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Epitope</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="epitope-id">Epitope ID</ServiceLabel>
              <ServiceInput
                id="epitope-id"
                placeholder="e.g. 10001"
                value={epitopeId}
                onChange={(e) => { setEpitopeId(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="epitope-type">Epitope Type</ServiceLabel>
              <ServiceInput
                id="epitope-type"
                placeholder="e.g. Linear peptide"
                value={epitopeType}
                onChange={(e) => { setEpitopeType(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item md:col-span-2">
              <ServiceLabel htmlFor="epitope-sequence">Epitope Sequence</ServiceLabel>
              <ServiceInput
                id="epitope-sequence"
                placeholder="e.g. GILGFVFTL"
                value={epitopeSequence}
                onChange={(e) => { setEpitopeSequence(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="protein-name">Protein Name</ServiceLabel>
              <ServiceInput
                id="protein-name"
                placeholder="e.g. Hemagglutinin"
                value={proteinName}
                onChange={(e) => { setProteinName(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="protein-accession">Protein Accession</ServiceLabel>
              <ServiceInput
                id="protein-accession"
                placeholder="e.g. P03437"
                value={proteinAccession}
                onChange={(e) => { setProteinAccession(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Assay Results</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {assayResultOptions.map((option) => (
              <div key={option} className="flex items-center gap-2">
                <Checkbox
                  id={`assay-${option}`}
                  checked={assayResults.has(option)}
                  onCheckedChange={() => { toggleAssayResult(option); }}
                />
                <Label htmlFor={`assay-${option}`}>{option}</Label>
              </div>
            ))}
          </div>
        </ServiceCardContent>
      </Card>

      <div className="service-form-controls">
        <Button type="reset" variant="outline">Reset</Button>
        <Button type="submit" variant="cta">Search</Button>
      </div>
    </form>
  );
}
