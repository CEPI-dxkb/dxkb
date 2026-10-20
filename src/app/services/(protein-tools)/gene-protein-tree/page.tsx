"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { ServiceSubmitError } from "@/components/services/form-ui/service-submit-error";
import { phylogeneticTreeInfo } from "@/lib/services/info/phylogenetic-tree";
import { GeneProteinTreeInput } from "./gene-protein-tree-input";
import { GeneProteinTreeMetadata } from "./gene-protein-tree-metadata";
import { GeneProteinTreeParameters } from "./gene-protein-tree-parameters";
import { useGeneProteinTree } from "./use-gene-protein-tree";

export default function GeneProteinTreePage() {
  const controller = useGeneProteinTree();
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
        title="Gene / Protein Tree"
        description="The Gene / Protein Tree Service enables construction of custom phylogenetic trees built from user-selected genes or proteins."
        infoPopupTitle={phylogeneticTreeInfo.title}
        infoPopupDescription={phylogeneticTreeInfo.description}
        quickReferenceGuide="https://www.bv-brc.org/docs/quick_references/services/genetree.html"
        tutorial="https://www.bv-brc.org/docs/tutorial/genetree/genetree.html"
        instructionalVideo="https://youtu.be/VtXWBRSdXRo"
      />
      <form
        action={() => form.handleSubmit()}
        className="grid grid-cols-1 items-start gap-4 md:grid-cols-2"
      >
        <GeneProteinTreeInput controller={controller} />
        <GeneProteinTreeParameters controller={controller} />
        <GeneProteinTreeMetadata controller={controller} />
        <ServiceSubmitError form={form} />
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
