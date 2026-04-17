import type { Library } from "@/types/services";

export type ServiceLibraryKind = "paired" | "single" | "sra";
export type ServiceFormField<TForm> = Extract<keyof TForm, string>;

export interface ServiceFormApi<TForm = Record<string, unknown>> {
  getFieldValue<K extends ServiceFormField<TForm>>(field: K): TForm[K];
  setFieldValue<K extends ServiceFormField<TForm>>(
    field: K,
    value: TForm[K],
  ): void;
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
