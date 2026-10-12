import { render, screen } from "@testing-library/react";
import { useForm } from "@tanstack/react-form";

import { DatabaseSelector } from "../database-selector";
import {
  completeFormSchema,
  defaultBlastFormValues,
  type BlastFormData,
} from "@/lib/forms/(genomics)/blast/blast-form-schema";

vi.mock("@/components/workspace/workspace-object-selector", () => ({
  WorkspaceObjectSelector: ({
    placeholder,
    value,
  }: {
    placeholder?: string;
    value?: string;
  }) => (
    <output aria-label={placeholder}>
      {value === undefined ? "<no value prop>" : value}
    </output>
  ),
}));

function Harness({
  database,
  field,
  path,
}: {
  database: BlastFormData["db_precomputed_database"];
  field: "db_genome_group" | "db_feature_group" | "db_fasta_file";
  path: string;
}) {
  const form = useForm({
    defaultValues: {
      ...defaultBlastFormValues,
      db_precomputed_database: database,
      [field]: path,
    } as BlastFormData,
    validators: { onChange: completeFormSchema, onSubmit: completeFormSchema },
  });
  return (
    <DatabaseSelector form={form} database={database} preset="featureFasta" />
  );
}

describe("DatabaseSelector workspace sources", () => {
  it.each([
    ["selGroup", "db_genome_group", "Select a genome group..."],
    ["selFeatureGroup", "db_feature_group", "Select a feature group..."],
    ["selFasta", "db_fasta_file", "Select a FASTA file..."],
  ] as const)(
    "%s shows the form's %s",
    (database, field, placeholder) => {
      render(
        <Harness database={database} field={field} path="/u@bvbrc/home/thing" />,
      );
      expect(screen.getByLabelText(placeholder)).toHaveTextContent(
        "/u@bvbrc/home/thing",
      );
    },
  );
});
