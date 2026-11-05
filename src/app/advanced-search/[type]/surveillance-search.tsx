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
import { rqlEq, rqlAnd, escapeRqlValue } from "@/lib/views/rql";
import { encodeQueryComponent } from "@/lib/url";

function rqlBetween(field: string, from: string, to: string): string {
  if (from && to) return `and(ge(${field},${escapeRqlValue(from)}),le(${field},${escapeRqlValue(to)}))`;
  if (from) return `ge(${field},${escapeRqlValue(from)})`;
  return `le(${field},${escapeRqlValue(to)})`;
}

export function SurveillanceSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [pathogenTestType, setPathogenTestType] = useState("");
  const [pathogenType, setPathogenType] = useState("");
  const [pathogenTestResult, setPathogenTestResult] = useState("");
  const [subtype, setSubtype] = useState("");
  const [hostGroup, setHostGroup] = useState("");
  const [hostCommonName, setHostCommonName] = useState("");
  const [hostSpecies, setHostSpecies] = useState("");
  const [geographicGroup, setGeographicGroup] = useState("");
  const [collectionCountry, setCollectionCountry] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (pathogenTestType.trim()) clauses.push(rqlEq("pathogen_test_type", pathogenTestType.trim()));
    if (pathogenType.trim()) clauses.push(rqlEq("pathogen_type", pathogenType.trim()));
    if (pathogenTestResult.trim()) clauses.push(rqlEq("pathogen_test_result", pathogenTestResult.trim()));
    if (subtype.trim()) clauses.push(rqlEq("subtype", subtype.trim()));
    if (hostGroup.trim()) clauses.push(rqlEq("host_group", hostGroup.trim()));
    if (hostCommonName.trim()) clauses.push(rqlEq("host_common_name", hostCommonName.trim()));
    if (hostSpecies.trim()) clauses.push(rqlEq("host_species", hostSpecies.trim()));
    if (geographicGroup.trim()) clauses.push(rqlEq("geographic_group", geographicGroup.trim()));
    if (collectionCountry.trim()) clauses.push(rqlEq("collection_country", collectionCountry.trim()));
    if (yearFrom.trim() || yearTo.trim()) {
      clauses.push(rqlBetween("collection_year", yearFrom.trim(), yearTo.trim()));
    }

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params: string[] = [];
    if (rql) params.push(`rql=${encodeQueryComponent(rql)}`);
    if (keyword.trim()) params.push(`keyword=${encodeQueryComponent(keyword.trim())}`);
    router.push(params.length ? `/surveillance?${params.join("&")}` : "/surveillance");
  };

  const handleReset = () => {
    setKeyword("");
    setPathogenTestType("");
    setPathogenType("");
    setPathogenTestResult("");
    setSubtype("");
    setHostGroup("");
    setHostCommonName("");
    setHostSpecies("");
    setGeographicGroup("");
    setCollectionCountry("");
    setYearFrom("");
    setYearTo("");
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
          <ServiceCardTitle>Pathogen</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="pathogen-test-type">Pathogen Test Type</ServiceLabel>
              <ServiceInput
                id="pathogen-test-type"
                placeholder="e.g. Influenza"
                value={pathogenTestType}
                onChange={(e) => { setPathogenTestType(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="pathogen-type">Pathogen Type</ServiceLabel>
              <ServiceInput
                id="pathogen-type"
                placeholder="e.g. Virus"
                value={pathogenType}
                onChange={(e) => { setPathogenType(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="pathogen-test-result">Pathogen Test Result</ServiceLabel>
              <ServiceInput
                id="pathogen-test-result"
                placeholder="e.g. Positive"
                value={pathogenTestResult}
                onChange={(e) => { setPathogenTestResult(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="subtype">Subtype</ServiceLabel>
              <ServiceInput
                id="subtype"
                placeholder="e.g. H3N2"
                value={subtype}
                onChange={(e) => { setSubtype(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

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
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="host-species">Host Species</ServiceLabel>
              <ServiceInput
                id="host-species"
                placeholder="e.g. Homo sapiens"
                value={hostSpecies}
                onChange={(e) => { setHostSpecies(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Geography</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="geographic-group">Geographic Group</ServiceLabel>
              <ServiceInput
                id="geographic-group"
                placeholder="e.g. Asia"
                value={geographicGroup}
                onChange={(e) => { setGeographicGroup(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="collection-country">Collection Country</ServiceLabel>
              <ServiceInput
                id="collection-country"
                placeholder="e.g. China"
                value={collectionCountry}
                onChange={(e) => { setCollectionCountry(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Collection Year</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="year-from">From</ServiceLabel>
              <ServiceInput
                id="year-from"
                type="number"
                min={1900}
                max={2100}
                placeholder="e.g. 2010"
                value={yearFrom}
                onChange={(e) => { setYearFrom(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="year-to">To</ServiceLabel>
              <ServiceInput
                id="year-to"
                type="number"
                min={1900}
                max={2100}
                placeholder="e.g. 2024"
                value={yearTo}
                onChange={(e) => { setYearTo(e.target.value); }}
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
