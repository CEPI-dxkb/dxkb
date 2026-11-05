import { notFound } from "next/navigation";
import {
  advancedSearchTypes,
  advancedSearchSlug,
} from "@/constants/search-info";
import { GenomeSearch } from "./genome-search";
import { TaxaSearch } from "./taxa-search";
import { FeatureSearch } from "./feature-search";
import { StrainSearch } from "./strain-search";
import { DomainsSearch } from "./domains-search";
import { EpitopeSearch } from "./epitope-search";
import { ProteinStructureSearch } from "./protein-structure-search";
import { SurveillanceSearch } from "./surveillance-search";
import { SerologySearch } from "./serology-search";
import { ExperimentSearch } from "./experiment-search";

interface Props {
  params: Promise<{ type: string }>;
}

function typeForSlug(slug: string) {
  return advancedSearchTypes.find(
    (t) => advancedSearchSlug(t.typeTitle) === slug,
  );
}

export function generateStaticParams() {
  return advancedSearchTypes.map((t) => ({
    type: advancedSearchSlug(t.typeTitle),
  }));
}

function SearchForm({ typeId }: { typeId: string }) {
  switch (typeId) {
    case "genome":
      return <GenomeSearch />;
    case "taxonomy":
      return <TaxaSearch />;
    case "genome_feature":
      return <FeatureSearch />;
    case "strain":
      return <StrainSearch />;
    case "protein_feature":
      return <DomainsSearch />;
    case "epitope":
      return <EpitopeSearch />;
    case "protein_structure":
      return <ProteinStructureSearch />;
    case "surveillance":
      return <SurveillanceSearch />;
    case "serology":
      return <SerologySearch />;
    case "experiment":
      return <ExperimentSearch />;
    default:
      return (
        <p className="text-muted-foreground">
          Advanced search for this type is coming soon.
        </p>
      );
  }
}

export default async function AdvancedSearchPage({ params }: Props) {
  const { type: slug } = await params;
  const searchType = typeForSlug(slug);
  if (!searchType) notFound();

  return (
    <section>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{searchType.typeTitle} Advanced Search</h1>
        <p className="text-sm text-muted-foreground">
          Use the fields below to build a precise search, then click Search to view results.
        </p>
      </div>
      <SearchForm typeId={searchType.id} />
    </section>
  );
}
