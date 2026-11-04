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

export function ExperimentSearch() {
  const router = useRouter();

  const [keyword, setKeyword] = useState("");
  const [expId, setExpId] = useState("");
  const [studyTitle, setStudyTitle] = useState("");
  const [studyDescription, setStudyDescription] = useState("");
  const [studyPi, setStudyPi] = useState("");
  const [studyInstitution, setStudyInstitution] = useState("");
  const [expTitle, setExpTitle] = useState("");
  const [expType, setExpType] = useState("");
  const [measurementTechnique, setMeasurementTechnique] = useState("");
  const [treatmentType, setTreatmentType] = useState("");
  const [treatmentName, setTreatmentName] = useState("");
  const [organism, setOrganism] = useState("");
  const [taxonId, setTaxonId] = useState("");
  const [strain, setStrain] = useState("");

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();

    const clauses: string[] = [];
    if (expId.trim()) clauses.push(rqlEq("exp_id", expId.trim()));
    if (studyTitle.trim()) clauses.push(rqlEq("study_title", studyTitle.trim()));
    if (studyDescription.trim()) clauses.push(rqlEq("study_description", studyDescription.trim()));
    if (studyPi.trim()) clauses.push(rqlEq("study_pi", studyPi.trim()));
    if (studyInstitution.trim()) clauses.push(rqlEq("study_institution", studyInstitution.trim()));
    if (expTitle.trim()) clauses.push(rqlEq("exp_title", expTitle.trim()));
    if (expType.trim()) clauses.push(rqlEq("exp_type", expType.trim()));
    if (measurementTechnique.trim()) clauses.push(rqlEq("measurement_technique", measurementTechnique.trim()));
    if (treatmentType.trim()) clauses.push(rqlEq("treatment_type", treatmentType.trim()));
    if (treatmentName.trim()) clauses.push(rqlEq("treatment_name", treatmentName.trim()));
    if (organism.trim()) clauses.push(rqlEq("organism", organism.trim()));
    if (taxonId.trim()) clauses.push(rqlEq("taxon_id", taxonId.trim()));
    if (strain.trim()) clauses.push(rqlEq("strain", strain.trim()));

    const rql = clauses.length > 0 ? rqlAnd(...clauses) : undefined;
    const params: string[] = [];
    if (rql) params.push(`rql=${encodeQueryComponent(rql)}`);
    if (keyword.trim()) params.push(`keyword=${encodeQueryComponent(keyword.trim())}`);
    router.push(params.length ? `/experiment?${params.join("&")}` : "/experiment");
  };

  const handleReset = () => {
    setKeyword("");
    setExpId("");
    setStudyTitle("");
    setStudyDescription("");
    setStudyPi("");
    setStudyInstitution("");
    setExpTitle("");
    setExpType("");
    setMeasurementTechnique("");
    setTreatmentType("");
    setTreatmentName("");
    setOrganism("");
    setTaxonId("");
    setStrain("");
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
          <ServiceCardTitle>Study</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exp-id">Experiment ID</Label>
              <Input
                id="exp-id"
                placeholder="e.g. EXP1234"
                value={expId}
                onChange={(e) => { setExpId(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="study-title">Study Title</Label>
              <Input
                id="study-title"
                placeholder="e.g. Influenza transcriptome"
                value={studyTitle}
                onChange={(e) => { setStudyTitle(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="study-description">Study Description</Label>
              <Input
                id="study-description"
                placeholder="e.g. RNA-seq"
                value={studyDescription}
                onChange={(e) => { setStudyDescription(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="study-pi">PI</Label>
              <Input
                id="study-pi"
                placeholder="e.g. Smith"
                value={studyPi}
                onChange={(e) => { setStudyPi(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="study-institution">Institution</Label>
              <Input
                id="study-institution"
                placeholder="e.g. NIH"
                value={studyInstitution}
                onChange={(e) => { setStudyInstitution(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Experiment</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exp-title">Experiment Title</Label>
              <Input
                id="exp-title"
                placeholder="e.g. Time course"
                value={expTitle}
                onChange={(e) => { setExpTitle(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exp-type">Experiment Type</Label>
              <Input
                id="exp-type"
                placeholder="e.g. RNA-Seq"
                value={expType}
                onChange={(e) => { setExpType(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="measurement-technique">Measurement Technique</Label>
              <Input
                id="measurement-technique"
                placeholder="e.g. microarray"
                value={measurementTechnique}
                onChange={(e) => { setMeasurementTechnique(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="treatment-type">Treatment Type</Label>
              <Input
                id="treatment-type"
                placeholder="e.g. drug"
                value={treatmentType}
                onChange={(e) => { setTreatmentType(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="treatment-name">Treatment Name</Label>
              <Input
                id="treatment-name"
                placeholder="e.g. oseltamivir"
                value={treatmentName}
                onChange={(e) => { setTreatmentName(e.target.value); }}
              />
            </div>
          </div>
        </ServiceCardContent>
      </Card>

      <Card>
        <ServiceCardHeader>
          <ServiceCardTitle>Organism</ServiceCardTitle>
        </ServiceCardHeader>
        <ServiceCardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="organism">Organism</Label>
              <Input
                id="organism"
                placeholder="e.g. Influenza A virus"
                value={organism}
                onChange={(e) => { setOrganism(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxon-id">Taxon ID</Label>
              <Input
                id="taxon-id"
                placeholder="e.g. 11520"
                value={taxonId}
                onChange={(e) => { setTaxonId(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="strain">Strain</Label>
              <Input
                id="strain"
                placeholder="e.g. A/Puerto Rico/8/34"
                value={strain}
                onChange={(e) => { setStrain(e.target.value); }}
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
