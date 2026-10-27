import { http, HttpResponse } from "msw";

import { genomeAnnotationService } from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-service";
import type { GenomeAnnotationFormData } from "@/lib/forms/(genomics)/genome-annotation/genome-annotation-form-schema";
import type { ServiceFormApi } from "@/lib/services/service-definition";
import { server } from "@/test-helpers/msw-server";

function fakeForm() {
  const values: Record<string, unknown> = {};
  const setFieldValue = vi.fn((field: string, value: unknown) => {
    values[field] = value;
  });
  const form = {
    getFieldValue: (field: string) => values[field],
    setFieldValue,
  } as unknown as ServiceFormApi<GenomeAnnotationFormData>;
  return { form, values, setFieldValue };
}

const rerunData = {
  contigs: "/user@bvbrc/home/contigs.fa",
  recipe: "default",
  taxonomy_id: 83332,
  scientific_name: "Mycobacterium tuberculosis H37Rv",
  my_label: "run1",
  output_path: "/user@bvbrc/home",
  output_file: "Mycobacterium tuberculosis H37Rv run1",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("genomeAnnotationService rerun", () => {
  it("restores the job's taxonomy name when the taxonomy lookup is down", async () => {
    let lookups = 0;
    server.use(
      http.get("*/api/services/taxonomy", () => {
        lookups += 1;
        return HttpResponse.json(
          { error: "BV-BRC Taxonomy API error: 503 Service Unavailable" },
          { status: 503 },
        );
      }),
    );
    const { form, values } = fakeForm();

    genomeAnnotationService.rerun?.onApply?.(rerunData, form, []);

    expect(values).toMatchObject({
      scientific_name: "Mycobacterium tuberculosis H37Rv",
      taxonomy_id: "83332",
      my_label: "run1",
    });
    await vi.waitFor(() => {
      expect(lookups).toBe(1);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(values.scientific_name).toBe("Mycobacterium tuberculosis H37Rv");
  });

  it("lets a successful lookup refresh the name", async () => {
    server.use(
      http.get("*/api/services/taxonomy", () =>
        HttpResponse.json([{ taxon_id: 83332, taxon_name: "Mycobacterium tuberculosis H37Rv (current)" }]),
      ),
    );
    const { form, values } = fakeForm();

    genomeAnnotationService.rerun?.onApply?.(rerunData, form, []);

    await vi.waitFor(() => {
      expect(values.scientific_name).toBe(
        "Mycobacterium tuberculosis H37Rv (current)",
      );
    });
  });
});
