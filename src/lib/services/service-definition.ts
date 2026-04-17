import type { Library } from "@/types/services";

export type ServiceLibraryKind = "paired" | "single" | "sra";

export interface ServiceFormApi<TForm = unknown> {
  getFieldValue(field: string): unknown;
  setFieldValue(field: string, value: never): void;
  reset?: (values?: TForm) => void;
}

export interface ServiceMetadata {
  title?: string;
  description?: string;
  quickReferenceGuide?: string;
  tutorial?: string;
  instructionalVideo?: string;
}

interface ServiceRerunBaseConfig<
  TForm,
  TRerun extends Record<string, unknown> = Record<string, unknown>,
> {
  fields?: readonly (keyof TRerun & string)[];
  onApply?: (
    rerunData: TRerun,
    form: ServiceFormApi<TForm>,
    libraries: Library[],
  ) => void;
  defaultOutputPath?: null;
}

type ServiceRerunLibraryConfig =
  | {
      libraries?: undefined;
      getLibraryExtra?: never;
      syncLibraries?: never;
    }
  | {
      libraries: readonly ServiceLibraryKind[];
      getLibraryExtra?: (
        lib: Record<string, string>,
        kind: ServiceLibraryKind,
      ) => Partial<Library>;
      syncLibraries: (libs: Library[]) => void;
    };

export type ServiceRerunConfig<
  TForm,
  TRerun extends Record<string, unknown> = Record<string, unknown>,
> = ServiceRerunBaseConfig<TForm, TRerun> & ServiceRerunLibraryConfig;

export interface ServiceDefinition<
  TForm,
  TRerun extends Record<string, unknown> = Record<string, unknown>,
> {
  serviceName: string;
  displayName: string;
  schema: unknown;
  defaultValues: TForm;
  transformParams(data: TForm): Record<string, unknown>;
  rerun?: ServiceRerunConfig<TForm, TRerun>;
  metadata?: ServiceMetadata;
}

export function createServiceDefinition<
  TForm,
  TRerun extends Record<string, unknown> = Record<string, unknown>,
>(
  definition: ServiceDefinition<TForm, TRerun>,
): ServiceDefinition<TForm, TRerun> {
  return definition;
}
