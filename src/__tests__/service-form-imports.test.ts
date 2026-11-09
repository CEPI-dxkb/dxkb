import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { valueImportsMatching } from "@/test-helpers/static-imports";

const srcDir = resolve(__dirname, "..");

// ServiceInput and ServiceTextarea are on every service form (~40 modules);
// ServiceNumberInput lives in service-number-input.tsx so only the five forms
// that render one load react-number-format.
const numberInput = /^@\/components\/ui\/number-input$|^react-number-format$/;
const serviceInput = "components/services/form-ui/service-input.tsx";

describe("service form imports", () => {
  it("keep the number input out of service-input.tsx", () => {
    const path = resolve(srcDir, serviceInput);
    expect(
      valueImportsMatching(readFileSync(path, "utf8"), dirname(path), numberInput),
    ).toEqual([]);
  });

  it("would catch a static import of the number input", () => {
    const fromDir = resolve(srcDir, "components/services/form-ui");
    expect(
      valueImportsMatching(
        'import { NumberInput } from "@/components/ui/number-input";\nimport { NumericFormat } from "react-number-format";',
        fromDir,
        numberInput,
      ),
    ).toEqual(["@/components/ui/number-input", "react-number-format"]);
    expect(
      valueImportsMatching(
        'import { NumberInput } from "../../ui/number-input";',
        fromDir,
        numberInput,
      ),
    ).toHaveLength(1);
    // A type-only import is erased, so it adds nothing to the bundle.
    expect(
      valueImportsMatching(
        'import type { NumberInputProps } from "@/components/ui/number-input";',
        fromDir,
        numberInput,
      ),
    ).toEqual([]);
  });
});
