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
import { featureListHref } from "@/lib/views/hrefs";

export function FeatureSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [genomeId, setGenomeId] = useState("");
  const [genomeName, setGenomeName] = useState("");
  const [taxonId, setTaxonId] = useState("");
  const [accession, setAccession] = useState("");
  const [featureType, setFeatureType] = useState("");
  const [annotation, setAnnotation] = useState("");
  const [gene, setGene] = useState("");
  const [product, setProduct] = useState("");
  const [patricId, setPatricId] = useState("");
  const [refseqLocusTag, setRefseqLocusTag] = useState("");
  const [uniprotkbAccession, setUniprotkbAccession] = useState("");
  const [plfamId, setPlfamId] = useState("");
  const [pgfamId, setPgfamId] = useState("");
  const [goTerm, setGoTerm] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (genomeId.trim()) clauses.push(rqlEq("genome_id", genomeId.trim()));
    if (genomeName.trim()) clauses.push(rqlEq("genome_name", genomeName.trim()));
    if (taxonId.trim()) clauses.push(rqlEq("taxon_id", taxonId.trim()));
    if (accession.trim()) clauses.push(rqlEq("accession", accession.trim()));
    if (featureType.trim()) clauses.push(rqlEq("feature_type", featureType.trim()));
    if (annotation.trim()) clauses.push(rqlEq("annotation", annotation.trim()));
    if (gene.trim()) clauses.push(rqlEq("gene", gene.trim()));
    if (product.trim()) clauses.push(rqlEq("product", product.trim()));
    if (patricId.trim()) clauses.push(rqlEq("patric_id", patricId.trim()));
    if (refseqLocusTag.trim()) clauses.push(rqlEq("refseq_locus_tag", refseqLocusTag.trim()));
    if (uniprotkbAccession.trim()) clauses.push(rqlEq("uniprotkb_accession", uniprotkbAccession.trim()));
    if (plfamId.trim()) clauses.push(rqlEq("plfam_id", plfamId.trim()));
    if (pgfamId.trim()) clauses.push(rqlEq("pgfam_id", pgfamId.trim()));
    if (goTerm.trim()) clauses.push(rqlEq("go", goTerm.trim()));

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    router.push(featureListHref({ rql, keyword: keyword.trim() || undefined }));
  };

  const handleReset = () => {
    setKeyword("");
    setGenomeId("");
    setGenomeName("");
    setTaxonId("");
    setAccession("");
    setFeatureType("");
    setAnnotation("");
    setGene("");
    setProduct("");
    setPatricId("");
    setRefseqLocusTag("");
    setUniprotkbAccession("");
    setPlfamId("");
    setPgfamId("");
    setGoTerm("");
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
              onChange={(e) => { setKeyword(e.target.value); }}
            />
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Genome</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="genome-id">Genome ID</Label>
              <Input
                id="genome-id"
                placeholder="e.g. 1332244.20"
                value={genomeId}
                onChange={(e) => { setGenomeId(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="genome-name">Genome Name</Label>
              <Input
                id="genome-name"
                placeholder="e.g. Influenza A virus"
                value={genomeName}
                onChange={(e) => { setGenomeName(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxon-id">Taxon ID</Label>
              <Input
                id="taxon-id"
                placeholder="e.g. 11320"
                value={taxonId}
                onChange={(e) => { setTaxonId(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accession">Accession</Label>
              <Input
                id="accession"
                placeholder="e.g. NC_002016"
                value={accession}
                onChange={(e) => { setAccession(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Feature</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="feature-type">Feature Type</Label>
              <Input
                id="feature-type"
                placeholder="e.g. CDS"
                value={featureType}
                onChange={(e) => { setFeatureType(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="annotation">Annotation</Label>
              <Input
                id="annotation"
                placeholder="e.g. PATRIC"
                value={annotation}
                onChange={(e) => { setAnnotation(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gene">Gene</Label>
              <Input
                id="gene"
                placeholder="e.g. PB1"
                value={gene}
                onChange={(e) => { setGene(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product">Product</Label>
              <Input
                id="product"
                placeholder="e.g. RNA-directed RNA polymerase catalytic subunit"
                value={product}
                onChange={(e) => { setProduct(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="go-term">GO Term</Label>
              <Input
                id="go-term"
                placeholder="e.g. GO:0003968"
                value={goTerm}
                onChange={(e) => { setGoTerm(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Identifiers</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="patric-id">BV-BRC ID</Label>
              <Input
                id="patric-id"
                placeholder="e.g. fig|1332244.20.peg.1"
                value={patricId}
                onChange={(e) => { setPatricId(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="refseq-locus-tag">RefSeq Locus Tag</Label>
              <Input
                id="refseq-locus-tag"
                placeholder="e.g. AFG23627"
                value={refseqLocusTag}
                onChange={(e) => { setRefseqLocusTag(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uniprotkb-accession">UniProtKB Accession</Label>
              <Input
                id="uniprotkb-accession"
                placeholder="e.g. P03433"
                value={uniprotkbAccession}
                onChange={(e) => { setUniprotkbAccession(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plfam-id">PLFam ID</Label>
              <Input
                id="plfam-id"
                placeholder="e.g. PLF_11234_00000001"
                value={plfamId}
                onChange={(e) => { setPlfamId(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pgfam-id">PGFam ID</Label>
              <Input
                id="pgfam-id"
                placeholder="e.g. PGF_00000001"
                value={pgfamId}
                onChange={(e) => { setPgfamId(e.target.value); }}
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
