import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
} from "@/components/services/form-ui/service-card";
import { blastServiceSearchProgram } from "@/lib/services/info/blast";
import { getCompatibleBlastDatabaseType } from "@/lib/forms/(genomics)/blast/blast-form-utils";
import type { BlastFormData } from "@/lib/forms/(genomics)/blast/blast-form-schema";
import type { BlastForm } from "./page";

export { BlastParameters } from "./blast-parameters";
export { InputSourceCard } from "./input-source-card";

export function SearchProgramCard({ form }: { form: BlastForm }) {
  const options = [
    ["blastn", "BLASTN (nucleotide → nucleotide database)"],
    ["blastp", "BLASTP (protein → protein database)"],
    ["blastx", "BLASTX (translated nucleotide → protein database)"],
    ["tblastn", "tBLASTn (protein → translated nucleotide database)"],
  ] as const;
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Search Program
          <DialogInfoPopup
            title={blastServiceSearchProgram.title}
            description={blastServiceSearchProgram.description}
            sections={blastServiceSearchProgram.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        <form.Field name="blast_program">
          {(field) => (
            <FieldItem>
              <RadioGroup
                value={field.state.value}
                onValueChange={(value) => {
                  const program = value as BlastFormData["blast_program"];
                  field.handleChange(program);
                  form.setFieldValue(
                    "db_type",
                    getCompatibleBlastDatabaseType(
                      form.state.values.db_type,
                      program,
                      form.state.values.db_precomputed_database,
                    ) as BlastFormData["db_type"],
                  );
                }}
                className="grid w-full grid-cols-1 gap-4 md:grid-cols-2"
              >
                {options.map(([value, label]) => (
                  <div key={value} className="flex items-center gap-3">
                    <RadioGroupItem value={value} id={value} />
                    <Label htmlFor={value}>
                      {label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
      </ServiceCardContent>
    </Card>
  );
}
