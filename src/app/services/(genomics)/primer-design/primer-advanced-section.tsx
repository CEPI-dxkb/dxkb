"use client";

import { ChevronDown, HelpCircle } from "lucide-react";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import {
  ServiceFieldLabel,
  ServiceFieldSubLabel,
} from "@/components/services/form-ui/service-field";
import { ServiceInput } from "@/components/services/form-ui/service-input";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import type { PrimerDesignController } from "./use-primer-design-form";

type ScalarFieldName =
  | "PRIMER_MIN_TM"
  | "PRIMER_OPT_TM"
  | "PRIMER_MAX_TM"
  | "PRIMER_PAIR_MAX_DIFF_TM"
  | "PRIMER_MIN_GC"
  | "PRIMER_OPT_GC"
  | "PRIMER_MAX_GC";

interface ScalarField {
  label: string;
  name: ScalarFieldName;
}

const temperatureFields = [
  { label: "Min", name: "PRIMER_MIN_TM" },
  { label: "Opt", name: "PRIMER_OPT_TM" },
  { label: "Max", name: "PRIMER_MAX_TM" },
  { label: "Max \u0394Tm", name: "PRIMER_PAIR_MAX_DIFF_TM" },
] as const satisfies readonly ScalarField[];
const gcFields = [
  { label: "Min", name: "PRIMER_MIN_GC" },
  { label: "Opt", name: "PRIMER_OPT_GC" },
  { label: "Max", name: "PRIMER_MAX_GC" },
] as const satisfies readonly ScalarField[];
const concentrationFields = [
  {
    label: "Concentration of Monovalent Cations (mM)",
    name: "PRIMER_SALT_MONOVALENT",
  },
  { label: "Annealing Oligo Concentration (nM)", name: "PRIMER_DNA_CONC" },
  {
    label: "Concentration of Divalent Cations (mM)",
    name: "PRIMER_SALT_DIVALENT",
  },
  { label: "Concentration of dNTPs (mM)", name: "PRIMER_DNTP_CONC" },
] as const;

function Help({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger aria-label="More information">
          <HelpCircle className="service-card-tooltip-icon" />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ScalarFields({
  controller,
  fields,
  columns,
}: {
  controller: PrimerDesignController;
  fields: readonly ScalarField[];
  columns: string;
}) {
  const { form } = controller;
  return (
    <div className={columns}>
      {fields.map(({ label, name }) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <FieldItem>
              <ServiceFieldSubLabel field={field}>
                {label}
              </ServiceFieldSubLabel>
              <ServiceInput
                id={field.name}
                value={field.state.value || ""}
                onChange={(event) => {
                  field.handleChange(event.target.value || undefined);
                }}
              />
              <FieldErrors field={field} />
            </FieldItem>
          )}
        </form.Field>
      ))}
    </div>
  );
}

export function PrimerAdvancedSection({
  controller,
}: {
  controller: PrimerDesignController;
}) {
  const { form, showAdvanced, setShowAdvanced } = controller;
  return (
    <ServiceCollapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
      <ServiceCollapsibleTrigger>
        Advanced Options
        <ChevronDown
          className={`size-4 transition-transform ${showAdvanced ? "rotate-180 transform" : ""}`}
        />
      </ServiceCollapsibleTrigger>
      <ServiceCollapsibleContent>
        <div className="space-y-3 px-2 py-3">
          <form.Field name="PRIMER_NUM_RETURN">
            {(field) => (
              <FieldItem>
                <div className="flex items-center gap-2">
                  <ServiceFieldLabel field={field}>
                    Number to Return
                  </ServiceFieldLabel>
                  <Help>
                    Maximum number of primer pairs to return. Larger values may
                    increase runtime.
                  </Help>
                </div>
                <ServiceInput
                  id={field.name}
                  value={field.state.value || ""}
                  onChange={(event) => {
                    field.handleChange(event.target.value || undefined);
                  }}
                  placeholder="5"
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ServiceLabel>
                Primer Tm ({"\u00B0"}C)
              </ServiceLabel>
              <Help>
                Define minimum, optimum, and maximum melting temperatures as
                well as the maximum pairwise difference.
              </Help>
            </div>
            <ScalarFields
              controller={controller}
              fields={temperatureFields}
              columns="grid grid-cols-1 gap-3 sm:grid-cols-4"
            />
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ServiceLabel>Primer GC%</ServiceLabel>
              <Help>
                Specify acceptable GC content range for designed primers.
              </Help>
            </div>
            <ScalarFields
              controller={controller}
              fields={gcFields}
              columns="grid grid-cols-1 gap-3 sm:grid-cols-3"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {concentrationFields.map(({ label, name }) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <FieldItem>
                    <ServiceFieldLabel field={field}>
                      {label}
                    </ServiceFieldLabel>
                    <ServiceInput
                      id={field.name}
                      value={field.state.value || ""}
                      onChange={(event) => {
                        field.handleChange(event.target.value || undefined);
                      }}
                    />
                    <FieldErrors field={field} />
                  </FieldItem>
                )}
              </form.Field>
            ))}
          </div>
        </div>
      </ServiceCollapsibleContent>
    </ServiceCollapsible>
  );
}
