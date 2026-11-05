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

export function SerologySearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [testType, setTestType] = useState("");
  const [testResult, setTestResult] = useState("");
  const [serotype, setSerotype] = useState("");
  const [hostType, setHostType] = useState("");
  const [hostCommonName, setHostCommonName] = useState("");
  const [hostSpecies, setHostSpecies] = useState("");
  const [geographicGroup, setGeographicGroup] = useState("");
  const [collectionCountry, setCollectionCountry] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (testType.trim()) clauses.push(rqlEq("test_type", testType.trim()));
    if (testResult.trim()) clauses.push(rqlEq("test_result", testResult.trim()));
    if (serotype.trim()) clauses.push(rqlEq("serotype", serotype.trim()));
    if (hostType.trim()) clauses.push(rqlEq("host_type", hostType.trim()));
    if (hostCommonName.trim()) clauses.push(rqlEq("host_common_name", hostCommonName.trim()));
    if (hostSpecies.trim()) clauses.push(rqlEq("host_species", hostSpecies.trim()));
    if (geographicGroup.trim()) clauses.push(rqlEq("geographic_group", geographicGroup.trim()));
    if (collectionCountry.trim()) clauses.push(rqlEq("collection_country", collectionCountry.trim()));
    if (yearFrom.trim() || yearTo.trim()) {
      clauses.push(rqlBetween("collection_year", yearFrom.trim(), yearTo.trim()));
    }
    if (dateFrom.trim() || dateTo.trim()) {
      clauses.push(rqlBetween("collection_date", dateFrom.trim(), dateTo.trim()));
    }

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params: string[] = [];
    if (rql) params.push(`rql=${encodeQueryComponent(rql)}`);
    if (keyword.trim()) params.push(`keyword=${encodeQueryComponent(keyword.trim())}`);
    router.push(params.length ? `/serology?${params.join("&")}` : "/serology");
  };

  const handleReset = () => {
    setKeyword("");
    setTestType("");
    setTestResult("");
    setSerotype("");
    setHostType("");
    setHostCommonName("");
    setHostSpecies("");
    setGeographicGroup("");
    setCollectionCountry("");
    setYearFrom("");
    setYearTo("");
    setDateFrom("");
    setDateTo("");
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
          <ServiceCardTitle>Test</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="service-card-content-grid">
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="test-type">Test Type</ServiceLabel>
              <ServiceInput
                id="test-type"
                placeholder="e.g. Hemagglutination Inhibition"
                value={testType}
                onChange={(e) => { setTestType(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="test-result">Test Result</ServiceLabel>
              <ServiceInput
                id="test-result"
                placeholder="e.g. Positive"
                value={testResult}
                onChange={(e) => { setTestResult(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="serotype">Serotype</ServiceLabel>
              <ServiceInput
                id="serotype"
                placeholder="e.g. H3N2"
                value={serotype}
                onChange={(e) => { setSerotype(e.target.value); }}
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
              <ServiceLabel htmlFor="host-type">Host Type</ServiceLabel>
              <ServiceInput
                id="host-type"
                placeholder="e.g. Avian"
                value={hostType}
                onChange={(e) => { setHostType(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="host-common-name">Host Common Name</ServiceLabel>
              <ServiceInput
                id="host-common-name"
                placeholder="e.g. Chicken"
                value={hostCommonName}
                onChange={(e) => { setHostCommonName(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="host-species">Host Species</ServiceLabel>
              <ServiceInput
                id="host-species"
                placeholder="e.g. Gallus gallus"
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
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); }}
              />
            </div>
            <div className="service-card-row-item">
              <ServiceLabel htmlFor="date-to">To</ServiceLabel>
              <ServiceInput
                id="date-to"
                placeholder="YYYY or YYYY-MM or YYYY-MM-DD"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); }}
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
