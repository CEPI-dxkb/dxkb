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
import { rqlEq, rqlAnd } from "@/lib/views/rql";
import { encodeQueryComponent } from "@/lib/url";

export function TaxaSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [taxonId, setTaxonId] = useState("");
  const [taxonName, setTaxonName] = useState("");
  const [taxonRank, setTaxonRank] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (taxonId.trim()) clauses.push(rqlEq("taxon_id", taxonId.trim()));
    if (taxonName.trim()) clauses.push(rqlEq("taxon_name", taxonName.trim()));
    if (taxonRank.trim()) clauses.push(rqlEq("taxon_rank", taxonRank.trim()));

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params: string[] = [];
    if (rql) params.push(`rql=${encodeQueryComponent(rql)}`);
    if (keyword.trim()) params.push(`keyword=${encodeQueryComponent(keyword.trim())}`);
    router.push(params.length ? `/taxonomy?${params.join("&")}` : "/taxonomy");
  };

  const handleReset = () => {
    setKeyword("");
    setTaxonId("");
    setTaxonName("");
    setTaxonRank("");
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
          <ServiceCardTitle>Taxon</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="taxon-id">Taxon ID</ServiceLabel>
              <ServiceInput
                id="taxon-id"
                placeholder="e.g. 11320"
                value={taxonId}
                onChange={(e) => { setTaxonId(e.target.value); }}
              />
            </div>
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
              <ServiceLabel htmlFor="taxon-rank">Taxon Rank</ServiceLabel>
              <ServiceInput
                id="taxon-rank"
                placeholder="e.g. genus"
                value={taxonRank}
                onChange={(e) => { setTaxonRank(e.target.value); }}
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
