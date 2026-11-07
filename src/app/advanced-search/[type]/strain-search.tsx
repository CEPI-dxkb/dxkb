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
import { GeographyCard, KeywordCard, PathogenCard, RangeCard } from "./advanced-search-fields";
import { rqlEq, rqlAnd, escapeRqlValue } from "@/lib/views/rql";
import { encodeQueryComponent } from "@/lib/url";

function rqlBetween(field: string, from: string, to: string): string {
  if (from && to) return `and(ge(${field},${escapeRqlValue(from)}),le(${field},${escapeRqlValue(to)}))`;
  if (from) return `ge(${field},${escapeRqlValue(from)})`;
  return `le(${field},${escapeRqlValue(to)})`;
}

export function StrainSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [taxonName, setTaxonName] = useState("");
  const [hostGroup, setHostGroup] = useState("");
  const [hostCommonName, setHostCommonName] = useState("");
  const [geographicGroup, setGeographicGroup] = useState("");
  const [isolationCountry, setIsolationCountry] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (taxonName.trim()) clauses.push(rqlEq("taxon_lineage_names", taxonName.trim()));
    if (hostGroup.trim()) clauses.push(rqlEq("host_group", hostGroup.trim()));
    if (hostCommonName.trim()) clauses.push(rqlEq("host_common_name", hostCommonName.trim()));
    if (geographicGroup.trim()) clauses.push(rqlEq("geographic_group", geographicGroup.trim()));
    if (isolationCountry.trim()) clauses.push(rqlEq("isolation_country", isolationCountry.trim()));
    if (yearFrom.trim() || yearTo.trim()) {
      clauses.push(rqlBetween("collection_year", yearFrom.trim(), yearTo.trim()));
    }

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params: string[] = [];
    if (rql) params.push(`rql=${encodeQueryComponent(rql)}`);
    if (keyword.trim()) params.push(`keyword=${encodeQueryComponent(keyword.trim())}`);
    router.push(params.length ? `/strain?${params.join("&")}` : "/strain");
  };

  const handleReset = () => {
    setKeyword("");
    setTaxonName("");
    setHostGroup("");
    setHostCommonName("");
    setGeographicGroup("");
    setIsolationCountry("");
    setYearFrom("");
    setYearTo("");
  };

  return (
    <form onSubmit={handleSubmit} onReset={handleReset} className="space-y-6">
      <KeywordCard value={keyword} onChange={setKeyword} />

      <PathogenCard value={taxonName} onChange={setTaxonName} />

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Host</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="host-group">Host Group</ServiceLabel>
              <ServiceInput
                id="host-group"
                placeholder="e.g. Human"
                value={hostGroup}
                onChange={(e) => { setHostGroup(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="host-common-name">Host Common Name</ServiceLabel>
              <ServiceInput
                id="host-common-name"
                placeholder="e.g. Human"
                value={hostCommonName}
                onChange={(e) => { setHostCommonName(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <GeographyCard
        country="isolation"
        group={geographicGroup}
        onGroupChange={setGeographicGroup}
        countryValue={isolationCountry}
        onCountryChange={setIsolationCountry}
      />

      <RangeCard
        kind="year"
        from={yearFrom}
        to={yearTo}
        onFromChange={setYearFrom}
        onToChange={setYearTo}
      />

      <div className="service-form-controls">
        <Button type="reset" variant="outline">Reset</Button>
        <Button type="submit" variant="cta">Search</Button>
      </div>
    </form>
  );
}
