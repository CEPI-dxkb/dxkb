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
import { rqlEq, rqlAnd } from "@/lib/views/rql";
import { encodeQueryComponent } from "@/lib/url";

export function ProteinStructureSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [taxonName, setTaxonName] = useState("");
  const [genomeId, setGenomeId] = useState("");
  const [patricId, setPatricId] = useState("");
  const [pdbId, setPdbId] = useState("");
  const [description, setDescription] = useState("");
  const [gene, setGene] = useState("");
  const [product, setProduct] = useState("");
  const [method, setMethod] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (taxonName.trim()) clauses.push(rqlEq("taxon_lineage_names", taxonName.trim()));
    if (genomeId.trim()) clauses.push(rqlEq("genome_id", genomeId.trim()));
    if (patricId.trim()) clauses.push(rqlEq("patric_id", patricId.trim()));
    if (pdbId.trim()) clauses.push(rqlEq("pdb_id", pdbId.trim()));
    if (description.trim()) clauses.push(rqlEq("title", description.trim()));
    if (gene.trim()) clauses.push(rqlEq("gene", gene.trim()));
    if (product.trim()) clauses.push(rqlEq("product", product.trim()));
    if (method.trim()) clauses.push(rqlEq("method", method.trim()));

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params: string[] = [];
    if (rql) params.push(`rql=${encodeQueryComponent(rql)}`);
    if (keyword.trim()) params.push(`keyword=${encodeQueryComponent(keyword.trim())}`);
    router.push(params.length ? `/protein-structure?${params.join("&")}` : "/protein-structure");
  };

  const handleReset = () => {
    setKeyword("");
    setTaxonName("");
    setGenomeId("");
    setPatricId("");
    setPdbId("");
    setDescription("");
    setGene("");
    setProduct("");
    setMethod("");
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
          <ServiceCardTitle>Pathogen / Genome</ServiceCardTitle>
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
            <div className="space-y-1.5">
              <Label htmlFor="genome-id">Genome ID</Label>
              <Input
                id="genome-id"
                placeholder="e.g. 1332244.20"
                value={genomeId}
                onChange={(e) => setGenomeId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="patric-id">BV-BRC ID</Label>
              <Input
                id="patric-id"
                placeholder="e.g. fig|1332244.20.peg.1"
                value={patricId}
                onChange={(e) => setPatricId(e.target.value)}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Structure</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pdb-id">PDB ID</Label>
              <Input
                id="pdb-id"
                placeholder="e.g. 1RUZ"
                value={pdbId}
                onChange={(e) => setPdbId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g. Hemagglutinin"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gene">Gene</Label>
              <Input
                id="gene"
                placeholder="e.g. HA"
                value={gene}
                onChange={(e) => setGene(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product">Product</Label>
              <Input
                id="product"
                placeholder="e.g. Hemagglutinin"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="method">Method</Label>
              <Input
                id="method"
                placeholder="e.g. X-RAY DIFFRACTION"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
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
