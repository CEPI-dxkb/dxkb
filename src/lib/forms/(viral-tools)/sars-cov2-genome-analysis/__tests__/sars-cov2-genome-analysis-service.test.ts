import { http, HttpResponse } from "msw";

import type { SarsCov2GenomeAnalysisFormData } from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-form-schema";
import { sarsCov2GenomeAnalysisService } from "@/lib/forms/(viral-tools)/sars-cov2-genome-analysis/sars-cov2-genome-analysis-service";
import type { ServiceFormApi } from "@/lib/services/service-definition";
import { server } from "@/test-helpers/msw-server";

function fakeForm() {
  const values: Record<string, unknown> = {};
  const form = {
    getFieldValue: (field: string) => values[field],
    setFieldValue: (field: string, value: unknown) => {
      values[field] = value;
    },
  } as unknown as ServiceFormApi<SarsCov2GenomeAnalysisFormData>;
  return { form, values };
}

// What `transformParams` sent for the job: the output name doubles as
// `scientific_name`, and there is no `my_label`.
const rerunData = {
  input_type: "reads",
  taxonomy_id: "2697049",
  scientific_name: "Severe acute respiratory syndrome coronavirus 2 myrun",
  output_path: "/user@bvbrc/home",
  output_file: "Severe acute respiratory syndrome coronavirus 2 myrun",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sarsCov2GenomeAnalysisService rerun", () => {
  it("restores My Label from the job up front, without waiting on the taxonomy lookup", () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json(
          { error: "BV-BRC Taxonomy API error: 503 Service Unavailable" },
          { status: 503 },
        ),
      ),
    );
    const { form, values } = fakeForm();

    sarsCov2GenomeAnalysisService.rerun?.onApply?.(rerunData, form, []);

    expect(values).toMatchObject({
      taxonomy_id: "2697049",
      scientific_name: "Severe acute respiratory syndrome coronavirus 2",
      my_label: "myrun",
    });
  });

  it("derives My Label from a looked-up name for another taxon", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json([{ taxon_id: 694009, taxon_name: "Severe acute respiratory syndrome-related coronavirus" }]),
      ),
    );
    const { form, values } = fakeForm();

    sarsCov2GenomeAnalysisService.rerun?.onApply?.(
      {
        ...rerunData,
        taxonomy_id: 694009,
        scientific_name: "Severe acute respiratory syndrome-related coronavirus lab7",
        output_file: "Severe acute respiratory syndrome-related coronavirus lab7",
      },
      form,
      [],
    );

    expect(values.my_label).toBeUndefined();
    await vi.waitFor(() => {
      expect(values.my_label).toBe("lab7");
    });
  });

  it("keeps a label the job carried itself", () => {
    const { form, values } = fakeForm();
    server.use(
      http.get("*/api/services/taxonomy", () => HttpResponse.json([])),
    );

    sarsCov2GenomeAnalysisService.rerun?.onApply?.(
      { ...rerunData, my_label: "own" },
      form,
      [],
    );

    expect(values.my_label).toBeUndefined();
  });
});
