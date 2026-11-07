"use client";

import { JobParamsDialog } from "@/components/services/job-params-dialog";
import { ServiceHeader } from "@/components/services/service-header";
import { ServiceFormFooter } from "@/components/services/form-ui/service-form-footer";
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
        <ServiceFormFooter
          form={form}
          onReset={handleReset}
          isSubmitting={isSubmitting}
          submitDisabled={!canSubmit || !isOutputNameValid}
          className="md:col-span-2"
        />
      </form>
      <JobParamsDialog {...jobParamsDialogProps} />
    </section>
  );
}
