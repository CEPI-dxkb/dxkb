"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const handleSubmit = (e: React.FormEvent) => {
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
      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Keyword</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="space-y-1.5">
            <Label htmlFor="keyword">Keyword</Label>
            <Input
              id="keyword"
              placeholder="Search term"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Pathogen</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="taxon-name">Taxon Name</Label>
              <Input
                id="taxon-name"
                placeholder="e.g. Influenza A virus"
                value={taxonName}
                onChange={(e) => setTaxonName(e.target.value)}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="host-group">Host Group</Label>
              <Input
                id="host-group"
                placeholder="e.g. Human"
                value={hostGroup}
                onChange={(e) => setHostGroup(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="host-common-name">Host Common Name</Label>
              <Input
                id="host-common-name"
                placeholder="e.g. Human"
                value={hostCommonName}
                onChange={(e) => setHostCommonName(e.target.value)}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="geographic-group">Geographic Group</Label>
              <Input
                id="geographic-group"
                placeholder="e.g. Asia"
                value={geographicGroup}
                onChange={(e) => setGeographicGroup(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="isolation-country">Isolation Country</Label>
              <Input
                id="isolation-country"
                placeholder="e.g. China"
                value={isolationCountry}
                onChange={(e) => setIsolationCountry(e.target.value)}
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="year-from">From</Label>
              <Input
                id="year-from"
                type="number"
                min={1900}
                max={2100}
                placeholder="e.g. 2010"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year-to">To</Label>
              <Input
                id="year-to"
                type="number"
                min={1900}
                max={2100}
                placeholder="e.g. 2024"
                value={yearTo}
                onChange={(e) => setYearTo(e.target.value)}
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
