"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { Card } from "@/components/ui/card";
import {
  ServiceCardHeader,
  ServiceCardContent,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import { KeywordCard } from "./advanced-search-fields";
import { rqlEq, rqlAnd } from "@/lib/views/rql";
import { toQueryString } from "@/lib/url";

export function DomainsSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [genomeId, setGenomeId] = useState("");
  const [patricId, setPatricId] = useState("");
  const [source, setSource] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (genomeId.trim()) clauses.push(rqlEq("genome_id", genomeId.trim()));
    if (patricId.trim()) clauses.push(rqlEq("patric_id", patricId.trim()));
    if (source.trim()) clauses.push(rqlEq("source", source.trim()));
    if (sourceId.trim()) clauses.push(rqlEq("source_id", sourceId.trim()));
    if (description.trim()) clauses.push(rqlEq("description", description.trim()));

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params = new URLSearchParams();
    if (rql) params.set("rql", rql);
    if (keyword.trim()) params.set("keyword", keyword.trim());
    const qs = toQueryString(params);
    router.push(qs ? `/domains-and-motifs?${qs}` : "/domains-and-motifs");
  };

  const handleReset = () => {
    setKeyword("");
    setGenomeId("");
    setPatricId("");
    setSource("");
    setSourceId("");
    setDescription("");
  };

  return (
    <form onSubmit={handleSubmit} onReset={handleReset} className="space-y-6">
      <KeywordCard value={keyword} onChange={setKeyword} />

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Pathogen / Genome</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
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
              <ServiceLabel htmlFor="patric-id">BV-BRC ID</ServiceLabel>
              <ServiceInput
                id="patric-id"
                placeholder="e.g. fig|1332244.20.peg.1"
                value={patricId}
                onChange={(e) => { setPatricId(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Domain / Motif</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="source">Source</ServiceLabel>
              <ServiceInput
                id="source"
                placeholder="e.g. CDD"
                value={source}
                onChange={(e) => { setSource(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="source-id">Source ID</ServiceLabel>
              <ServiceInput
                id="source-id"
                placeholder="e.g. cd00001"
                value={sourceId}
                onChange={(e) => { setSourceId(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="description">Description</ServiceLabel>
              <ServiceInput
                id="description"
                placeholder="e.g. RNA-dependent RNA polymerase"
                value={description}
                onChange={(e) => { setDescription(e.target.value); }}
              />
            </div>
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
