"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { phylogeneticTreeInfo } from "@/lib/services/info/phylogenetic-tree";
import { useViralGenomeTree } from "./use-viral-genome-tree";
import { ViralGenomeTreeInput } from "./viral-genome-tree-input";
import { ViralGenomeTreeMetadata } from "./viral-genome-tree-metadata";
import { ViralGenomeTreeParameters } from "./viral-genome-tree-parameters";

export default function ViralGenomeTreePage() {
  const controller = useViralGenomeTree();
  const {
    form,
    isSubmitting,
    canSubmit,
    isOutputNameValid,
    handleReset,
    jobParamsDialogProps,
  } = controller;
  return (
    <section>
      <ServiceHeader
        title="Viral Genome Tree"
        description="The Viral Genome Tree Service enables construction of whole genome alignment based phylogenetic trees for user-selected viral genomes."
        infoPopupTitle={phylogeneticTreeInfo.title}
        infoPopupDescription={phylogeneticTreeInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/genetree.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/genetree/genetree.html"
        instructionalVideo="https://www.youtube.com/watch?v=VtXWBRSdXRo"
      />
      <form
        action={() => form.handleSubmit()}
        className="grid grid-cols-1 items-start gap-4 md:grid-cols-2"
      >
        <ViralGenomeTreeInput controller={controller} />
        <ViralGenomeTreeParameters controller={controller} />
        <ViralGenomeTreeMetadata controller={controller} />
        <div className="service-form-controls md:col-span-2">
          <Button type="button" variant="outline" onClick={handleReset}>
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || !canSubmit || !isOutputNameValid}
          >
            {isSubmitting ? <Spinner /> : null}
            Submit
          </Button>
        </div>
      </form>
      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
