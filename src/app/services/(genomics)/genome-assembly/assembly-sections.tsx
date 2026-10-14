import { useId } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DialogInfoPopup } from "@/components/services/dialog-info-popup";
import OutputFolder from "@/components/services/output-folder";
import SelectedItemsTable from "@/components/services/selected-items-table";
import SraRunAccessionWithValidation from "@/components/services/sra-run-accession-with-validation";
import { WorkspaceObjectSelector } from "@/components/workspace/workspace-object-selector";
import { RequiredFormCardTitle } from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardDescription,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import { ServiceFieldLabel } from "@/components/services/form-ui/service-field";
import { ServiceNumberInput } from "@/components/services/form-ui/service-input";
import {
  ServiceLibraryAddButton,
  ServiceLibraryHeader,
} from "@/components/services/form-ui/service-library-header";
import { ServiceRequiredLabel } from "@/components/services/form-ui/service-required-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import {
  genomeAssemblyGenomeParameters,
  genomeAssemblyParameters,
  genomeAssemblyPolishing,
  genomeAssemblyReadProcessing,
  genomeAssemblyThresholds,
  readInputFileInfo,
} from "@/lib/services/info/genome-assembly";
import {
  calculateGenomeSize,
  genomeAssemblyRecipes,
  genomeSizeUnitOptions,
} from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-form-utils";
import type { Library, ServiceInfoPopup } from "@/types/services";
import type { WorkspaceObject } from "@/lib/services/workspace/types";
import type { AssemblyAction, AssemblyForm, AssemblyUiState } from "./page";

interface InputProps {
  state: AssemblyUiState;
  dispatch: React.Dispatch<AssemblyAction>;
  libraries: Library[];
  setLibraries: (libraries: Library[]) => void;
  addPaired: () => void;
  addSingle: () => void;
}
export function AssemblyInputs({
  state,
  dispatch,
  libraries,
  setLibraries,
  addPaired,
  addSingle,
}: InputProps) {
  return (
    <Card>
      <ServiceCardHeader>
        <RequiredFormCardTitle>
          Input Files
          <DialogInfoPopup
            title={readInputFileInfo.title}
            description={readInputFileInfo.description}
            sections={readInputFileInfo.sections}
          />
        </RequiredFormCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent className="space-y-6">
        <ReadInput
          title="Paired Read Library"
          disabled={!state.pairedRead1 || !state.pairedRead2}
          onAdd={addPaired}
        >
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE 1..."
            value={state.pairedRead1 ?? ""}
            onObjectSelect={(object: WorkspaceObject) => {
              dispatch({
                type: "set-read",
                read: "pairedRead1",
                value: object.path,
              });
            }}
          />
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE 2..."
            value={state.pairedRead2 ?? ""}
            onObjectSelect={(object: WorkspaceObject) => {
              dispatch({
                type: "set-read",
                read: "pairedRead2",
                value: object.path,
              });
            }}
          />
        </ReadInput>
        <ReadInput
          title="Single Read Library"
          disabled={!state.singleRead}
          onAdd={addSingle}
        >
          <WorkspaceObjectSelector
            preset="reads"
            placeholder="Select READ FILE..."
            value={state.singleRead ?? ""}
            onObjectSelect={(object: WorkspaceObject) => {
              dispatch({
                type: "set-read",
                read: "singleRead",
                value: object.path,
              });
            }}
          />
        </ReadInput>
        <SraRunAccessionWithValidation
          key={state.sraResetKey}
          title="SRA Run Accession"
          placeholder="SRR..."
          selectedLibraries={libraries}
          setSelectedLibraries={setLibraries}
          allowDuplicates={false}
        />
      </ServiceCardContent>
    </Card>
  );
}
function ReadInput({
  title,
  disabled,
  onAdd,
  children,
}: {
  title: string;
  disabled: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <ServiceLibraryHeader title={title}>
        <ServiceLibraryAddButton
          aria-label={`Add ${title.toLowerCase()} to selected libraries`}
          onClick={onAdd}
          disabled={disabled}
        />
      </ServiceLibraryHeader>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function SelectedLibraries({
  libraries,
  onRemove,
  mobile = false,
}: {
  libraries: Library[];
  onRemove: (id: string) => void;
  mobile?: boolean;
}) {
  return (
    <div className={mobile ? "md:hidden" : "hidden md:col-span-5 md:block"}>
      <Card className="h-full">
        <ServiceCardHeader>
          <ServiceCardTitle>
            Selected Libraries
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger aria-label="Selected libraries help">
                  <HelpCircle className="service-card-tooltip-icon" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Read files placed here will contribute to a single analysis.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ServiceCardTitle>
          <ServiceCardDescription>
            Place read files here using the arrow buttons.
          </ServiceCardDescription>
        </ServiceCardHeader>
        <ServiceCardContent>
          <SelectedItemsTable
            items={libraries.map((library) => ({
              id: library.id,
              name: library.name,
              type: library.type,
            }))}
            onRemove={onRemove}
            className="max-h-84 overflow-y-auto"
          />
        </ServiceCardContent>
      </Card>
    </div>
  );
}

interface ParametersProps {
  form: AssemblyForm;
  state: AssemblyUiState;
  dispatch: React.Dispatch<AssemblyAction>;
  outputPath: string;
}
export function AssemblyParameters({
  form,
  state,
  dispatch,
  outputPath,
}: ParametersProps) {
  return (
    <Card>
      <ServiceCardHeader>
        <ServiceCardTitle>
          Parameters
          <DialogInfoPopup
            title={genomeAssemblyParameters.title}
            description={genomeAssemblyParameters.description}
            sections={genomeAssemblyParameters.sections}
          />
        </ServiceCardTitle>
      </ServiceCardHeader>
      <ServiceCardContent>
        <div className="space-y-6">
          <form.Field name="recipe">
            {(field) => (
              <FieldItem>
                <ServiceRequiredLabel>Assembly Strategy</ServiceRequiredLabel>
                <Select
                  items={genomeAssemblyRecipes}
                  value={field.state.value}
                  onValueChange={(value) => {
                    field.handleChange(value as string);
                  }}
                >
                  <ServiceSelectTrigger aria-label="Assembly strategy">
                    <SelectValue placeholder="Select strategy" />
                  </ServiceSelectTrigger>
                  <SelectContent>
                    {genomeAssemblyRecipes.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <form.Field name="output_path">
            {(field) => (
              <FieldItem>
                <OutputFolder
                  required
                  value={field.state.value}
                  onChange={field.handleChange}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <form.Field name="output_file">
            {(field) => (
              <FieldItem>
                <OutputFolder
                  variant="name"
                  required
                  value={field.state.value}
                  onChange={field.handleChange}
                  outputFolderPath={outputPath}
                  onValidationChange={(valid) => {
                    dispatch({ type: "set-output-valid", value: valid });
                  }}
                />
                <FieldErrors field={field} />
              </FieldItem>
            )}
          </form.Field>
          <AdvancedOptions
            form={form}
            state={state}
            dispatch={dispatch}
            open={state.showAdvanced}
            setOpen={(value) => {
              dispatch({ type: "set-advanced", value });
            }}
          />
        </div>
      </ServiceCardContent>
    </Card>
  );
}
function AdvancedOptions({
  form,
  state,
  dispatch,
  open,
  setOpen,
}: {
  form: AssemblyForm;
  state: AssemblyUiState;
  dispatch: React.Dispatch<AssemblyAction>;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const switches = [
    ["normalize", "Normalize Illumina Reads"],
    ["trim", "Trim Short Reads"],
    ["filtlong", "Filter Long Reads"],
  ] as const;
  return (
    <ServiceCollapsible open={open} onOpenChange={setOpen}>
      <ServiceCollapsibleTrigger>
        Advanced Options
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180 transform" : ""}`}
        />
      </ServiceCollapsibleTrigger>
      {/* The four groups of BV-BRC's Assembly2 form, in its order. */}
      <ServiceCollapsibleContent>
        <div className="space-y-6">
          <AdvancedSection info={genomeAssemblyReadProcessing}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {switches.map(([name, label]) => (
                <form.Field key={name} name={name}>
                  {(field) => (
                    <FieldItem className="flex flex-col items-start justify-between">
                      <ServiceFieldLabel field={field}>
                        {label}
                      </ServiceFieldLabel>
                      <Switch
                        id={field.name}
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                      />
                    </FieldItem>
                  )}
                </form.Field>
              ))}
            </div>
          </AdvancedSection>
          <AdvancedSection info={genomeAssemblyGenomeParameters}>
            <div className="service-card-content-grid">
              <GenomeSizeField form={form} state={state} dispatch={dispatch} />
              <AdvancedNumberField
                form={form}
                name="target_depth"
                label="Target Genome Coverage"
                min={100}
                max={500}
                stepper={50}
              />
            </div>
          </AdvancedSection>
          <AdvancedSection info={genomeAssemblyPolishing}>
            <div className="service-card-content-grid">
              <AdvancedNumberField
                form={form}
                name="racon_iter"
                label="Racon Iterations"
                min={0}
                max={4}
                stepper={1}
              />
              <AdvancedNumberField
                form={form}
                name="pilon_iter"
                label="Pilon Iterations"
                min={0}
                max={4}
                stepper={1}
              />
            </div>
          </AdvancedSection>
          <AdvancedSection info={genomeAssemblyThresholds}>
            <div className="service-card-content-grid">
              <AdvancedNumberField
                form={form}
                name="min_contig_len"
                label="Min. contig length"
                min={100}
                max={100000}
                stepper={10}
              />
              <AdvancedNumberField
                form={form}
                name="min_contig_cov"
                label="Min. contig coverage"
                min={0}
                max={100000}
                stepper={5}
              />
            </div>
          </AdvancedSection>
        </div>
      </ServiceCollapsibleContent>
    </ServiceCollapsible>
  );
}

/**
 * One titled group of Advanced Options, its info popup beside the title. The
 * title sits a size above the field labels so the groups read apart; it is not
 * a heading element, because the card titles above it are not headings either
 * and an `h3` here would skip levels.
 */
function AdvancedSection({
  info,
  children,
}: {
  info: ServiceInfoPopup;
  children: React.ReactNode;
}) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="space-y-2">
      <div className="flex items-center gap-1">
        <span id={titleId} className="text-base font-semibold">
          {info.title}
        </span>
        <DialogInfoPopup
          title={info.title}
          description={info.description}
          sections={info.sections}
        />
      </div>
      {children}
    </div>
  );
}

function AdvancedNumberField({
  form,
  name,
  label,
  min,
  max,
  stepper,
}: {
  form: AssemblyForm;
  name:
    | "target_depth"
    | "racon_iter"
    | "pilon_iter"
    | "min_contig_len"
    | "min_contig_cov";
  label: string;
  min: number;
  max: number;
  stepper: number;
}) {
  return (
    <form.Field name={name}>
      {(field) => (
        <FieldItem>
          <ServiceFieldLabel field={field}>{label}</ServiceFieldLabel>
          <ServiceNumberInput
            id={field.name}
            value={field.state.value}
            onValueChange={field.handleChange}
            min={min}
            max={max}
            stepper={stepper}
          />
          <FieldErrors field={field} />
        </FieldItem>
      )}
    </form.Field>
  );
}

/**
 * Estimated Genome Size, as BV-BRC's Assembly2 form asks for it under Genome
 * Parameters: a count in megabases or kilobases. The page state holds the
 * count and unit; the form holds `genome_size` in bases. Switching the unit
 * resets the count to that unit's default (5 M or 500 K), as BV-BRC does.
 */
function GenomeSizeField({
  form,
  state,
  dispatch,
}: {
  form: AssemblyForm;
  state: AssemblyUiState;
  dispatch: React.Dispatch<AssemblyAction>;
}) {
  const megabases = state.genomeSizeUnit === "M";
  return (
    <form.Field name="genome_size">
      {(field) => (
        <FieldItem>
          <ServiceFieldLabel field={field}>
            Estimated Genome Size
          </ServiceFieldLabel>
          <div className="flex items-center gap-2">
            <ServiceNumberInput
              id={field.name}
              value={state.expectedGenomeSize}
              onValueChange={(value) => {
                // NumericFormat also reports the count the page set (a rerun
                // or unit switch). The form already holds those bases, and a
                // rerun's may not be a whole kilobase, so leave it alone.
                if (value === state.expectedGenomeSize) return;
                dispatch({ type: "set-genome-size", value });
                field.handleChange(
                  value === undefined
                    ? undefined
                    : calculateGenomeSize(value, state.genomeSizeUnit),
                );
              }}
              min={megabases ? 1 : 100}
              max={megabases ? 10 : 10000}
              stepper={megabases ? 1 : 100}
            />
            <Select
              items={genomeSizeUnitOptions}
              value={state.genomeSizeUnit}
              onValueChange={(unit) => {
                if (unit) {
                  dispatch({ type: "set-unit", unit });
                  field.handleChange(unit === "M" ? 5000000 : 500000);
                }
              }}
            >
              <ServiceSelectTrigger
                aria-label="Genome size unit"
                className="w-20"
              >
                <SelectValue />
              </ServiceSelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {genomeSizeUnitOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <span aria-hidden="true">&times;</span>
          </div>
          <FieldErrors field={field} />
        </FieldItem>
      )}
    </form.Field>
  );
}
