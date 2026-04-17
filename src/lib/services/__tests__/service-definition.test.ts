import { createServiceDefinition } from "@/lib/services/service-definition";

describe("createServiceDefinition", () => {
  it("preserves service identity and typed transform params", () => {
    const definition = createServiceDefinition({
      serviceName: "ExampleService",
      displayName: "Example Service",
      schema: null,
      defaultValues: { output_path: "", count: 1 },
      transformParams: (data: { output_path: string; count: number }) => ({
        output_path: data.output_path.trim(),
        count: String(data.count),
      }),
    });

    expect(definition.serviceName).toBe("ExampleService");
    expect(definition.displayName).toBe("Example Service");
    expect(
      definition.transformParams({ output_path: " /ws/out ", count: 3 }),
    ).toEqual({ output_path: "/ws/out", count: "3" });
  });
});
