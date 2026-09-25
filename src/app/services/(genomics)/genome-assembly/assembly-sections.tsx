import { ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription } from "@/components/ui/card";
import { FieldErrors, FieldItem } from "@/components/ui/tanstack-form";
import { NumberInput } from "@/components/ui/number-input";
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
import {
  RequiredFormCardTitle,
  RequiredFormLabel,
} from "@/components/forms/required-form-components";
import {
  ServiceCardContent,
  ServiceCardHeader,
  ServiceCardTitle,
} from "@/components/services/form-ui/service-card";
import {
  ServiceCollapsible,
  ServiceCollapsibleContent,
  ServiceCollapsibleTrigger,
} from "@/components/services/form-ui/service-collapsible";
import {
  ServiceFieldLabel,
  ServiceFieldSubLabel,
} from "@/components/services/form-ui/service-field";
import { ServiceLabel } from "@/components/services/form-ui/service-label";
import { ServiceSelectTrigger } from "@/components/services/form-ui/service-select";
import {
  genomeAssemblyParameters,
  readInputFileInfo,
} from "@/lib/services/info/genome-assembly";
import {
  calculateGenomeSize,
  genomeAssemblyRecipes,
  genomeSizeUnitOptions,
} from "@/lib/forms/(genomics)/genome-assembly/genome-assembly-form-utils";
import type { Library } from "@/types/services";
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
      <div className="flex items-center justify-between">
        <ServiceLabel>{title}</ServiceLabel>
        <div className="mx-4 h-px flex-1 bg-border" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Add ${title.toLowerCase()} to selected libraries`}
          onClick={onAdd}
          disabled={disabled}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
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
          <CardDescription>
            Place read files here using the arrow buttons.
          </CardDescription>
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
  showGenomeSize: boolean;
}
export function AssemblyParameters({
  form,
  state,
  dispatch,
  outputPath,
  showGenomeSize,
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
                <RequiredFormLabel>Assembly Strategy</RequiredFormLabel>
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
          {showGenomeSize && (
            <form.Field name="genome_size">
              {(field) => (
                <FieldItem>
                  <ServiceFieldLabel field={field}>
                    Estimated Genome Size
                  </ServiceFieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      id={field.name}
                      name={field.name}
                      aria-label="Estimated Genome Size"
                      type="number"
                      value={state.expectedGenomeSize}
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber;
                        if (Number.isFinite(value)) {
                          dispatch({ type: "set-genome-size", value });
                          field.handleChange(
                            calculateGenomeSize(value, state.genomeSizeUnit),
                          );
                        }
                      }}
                      className="service-card-input flex-1"
                      min={state.genomeSizeUnit === "M" ? 1 : 100}
                      max={state.genomeSizeUnit === "M" ? 10 : 10000}
                    />
                    <span className="text-lg">&times;</span>
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
                  </div>
                  <FieldErrors field={field} />
                </FieldItem>
              )}
            </form.Field>
          )}
          <AdvancedOptions
            form={form}
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
  open,
  setOpen,
}: {
  form: AssemblyForm;
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const switches = [
    ["normalize", "Normalize Illumina Reads"],
    ["trim", "Trim Short Reads"],
    ["filtlong", "Filter Long Reads"],
  ] as const;
  const numbers = [
    ["target_depth", "Target Genome Coverage", 100, 500, 50],
    ["racon_iter", "Racon Iterations", 0, 4, 1],
    ["pilon_iter", "Pilon Iterations", 0, 4, 1],
    ["min_contig_len", "Min. contig length", 100, 100000, 10],
    ["min_contig_cov", "Min. contig coverage", 0, 100000, 5],
  ] as const;
  return (
    <ServiceCollapsible open={open} onOpenChange={setOpen}>
      <ServiceCollapsibleTrigger>
        Advanced Options
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180 transform" : ""}`}
        />
      </ServiceCollapsibleTrigger>
      <ServiceCollapsibleContent>
        <div className="space-y-4">
          <ServiceLabel>Read Processing</ServiceLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {switches.map(([name, label]) => (
              <form.Field key={name} name={name}>
                {(field) => (
                  <FieldItem className="flex flex-col items-start justify-between">
                    <ServiceFieldSubLabel field={field}>
                      {label}
                    </ServiceFieldSubLabel>
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
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {numbers.map(([name, label, min, max, stepper]) => (
            <form.Field key={name} name={name}>
              {(field) => (
                <FieldItem>
                  <ServiceFieldSubLabel field={field}>
                    {label}
                  </ServiceFieldSubLabel>
                  <NumberInput
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
          ))}
        </div>
      </ServiceCollapsibleContent>
    </ServiceCollapsible>
  );
}
