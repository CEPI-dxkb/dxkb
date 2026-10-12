import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { render, screen } from "@testing-library/react";

import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";

// These are local edits to shadcn files that `shadcn add --overwrite` would
// revert (see AGENTS.md). The look itself (fill, cursor, hover) is checked in
// the browser by e2e/tests/services/service-form-controls.spec.ts; this pins
// the classes that produce it, which jsdom cannot compute.

/** Every class on the element, split, so a test can look for exact tokens. */
function classes(element: Element): string[] {
  return (element.getAttribute("class") ?? "").split(/\s+/);
}

describe("disabled fields share the bg-disabled fill", () => {
  it.each([
    ["Input", () => <Input aria-label="field" disabled />],
    ["Textarea", () => <Textarea aria-label="field" disabled />],
  ])("%s takes the fill, muted text and cursor at full opacity", (_name, ui) => {
    render(ui());
    const field = screen.getByRole("textbox", { name: "field" });

    expect(classes(field)).toEqual(
      expect.arrayContaining([
        "disabled:bg-disabled",
        // Without it, `dark:bg-input/30` (sorted after `disabled:`) would win.
        "dark:disabled:bg-disabled",
        "disabled:text-muted-foreground",
        "disabled:cursor-not-allowed",
      ]),
    );
    expect(classes(field)).not.toContain("disabled:opacity-50");
    // It hid the not-allowed cursor.
    expect(classes(field)).not.toContain("disabled:pointer-events-none");
  });

  it("SelectTrigger takes the fill, muted text and cursor at full opacity", () => {
    render(
      <Select disabled>
        <SelectTrigger aria-label="recipe">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "recipe" });

    expect(classes(trigger)).toEqual(
      expect.arrayContaining([
        "disabled:bg-disabled",
        "dark:disabled:bg-disabled",
        "disabled:text-muted-foreground",
        "disabled:cursor-not-allowed",
      ]),
    );
    expect(classes(trigger)).not.toContain("disabled:opacity-50");
  });

  it("InputGroup takes the fill on the group, and its input stays transparent", () => {
    render(
      <InputGroup data-testid="group">
        <InputGroupInput aria-label="search" disabled />
      </InputGroup>,
    );
    const group = screen.getByTestId("group");

    expect(classes(group)).toEqual(
      expect.arrayContaining([
        "has-disabled:bg-disabled",
        "dark:has-disabled:bg-disabled",
        "has-disabled:text-muted-foreground",
        "has-disabled:cursor-not-allowed",
      ]),
    );
    expect(classes(group)).not.toContain("has-disabled:opacity-50");
    // The group's fill shows through; a second fill would stack on it.
    expect(classes(screen.getByRole("textbox", { name: "search" }))).toEqual(
      expect.arrayContaining(["disabled:bg-transparent", "disabled:opacity-100"]),
    );
  });
});

describe("disabled controls receive the pointer, for the not-allowed cursor", () => {
  it("Button keeps its dimmed look but no longer drops pointer events", () => {
    render(<Button disabled>Submit</Button>);
    const button = screen.getByRole("button", { name: "Submit" });

    expect(button).toBeDisabled();
    expect(classes(button)).toContain("disabled:opacity-50");
    expect(classes(button)).not.toContain("disabled:pointer-events-none");
  });

  it("Slider shows the cursor on its disabled control", () => {
    const { container } = render(<Slider aria-label="weight" disabled value={[5]} />);

    const control = container.querySelector("[data-disabled]");
    expect(control).not.toBeNull();
    expect(container.innerHTML).toContain("data-disabled:cursor-not-allowed");
    expect(container.innerHTML).not.toContain("disabled:pointer-events-none");
  });

  // Base UI draws these as a <span> beside a hidden 1px <input>, so only the
  // input matches `:disabled`, and a `disabled:` cursor never showed.
  it.each([
    [
      "RadioGroupItem",
      () => (
        <RadioGroup>
          <RadioGroupItem value="a" id="choice" disabled />
          <Label htmlFor="choice">Choice</Label>
        </RadioGroup>
      ),
      "radio",
    ],
    [
      "Checkbox",
      () => (
        <>
          <Checkbox id="choice" disabled />
          <Label htmlFor="choice">Choice</Label>
        </>
      ),
      "checkbox",
    ],
  ] as const)(
    "%s shows the cursor and dims on its span, and the label beside it shows the cursor",
    (_name, ui, role) => {
      render(ui());
      const control = screen.getByRole(role, { name: "Choice" });

      expect(control.tagName).toBe("SPAN");
      expect(control).toHaveAttribute("data-disabled");
      expect(classes(control)).toContain("data-disabled:cursor-not-allowed");
      expect(classes(control)).not.toContain("disabled:cursor-not-allowed");
      // Dimmed the same way, or it stays fully opaque.
      expect(classes(control)).toContain("data-disabled:opacity-50");
      expect(classes(control)).not.toContain("disabled:opacity-50");
      // The control is the label's `peer`.
      expect(classes(control)).toContain("peer");
      expect(classes(screen.getByText("Choice"))).toContain(
        "peer-data-disabled:cursor-not-allowed",
      );
    },
  );

  it.each(["src/components/ui/tabs.tsx", "src/components/ui/navigation-menu.tsx"])(
    "%s drops pointer events only for aria-/data-disabled, never native :disabled",
    (file) => {
      const source = readFileSync(
        join(resolve(__dirname, "..", "..", "..", ".."), file),
        "utf8",
      );
      // `aria-disabled:pointer-events-none` (tabs) still blocks clicks that
      // nothing native blocks; a bare `disabled:` one hid the cursor.
      // Class tokens only: the files' comments name the class in backticks.
      expect(source).not.toMatch(
        /(?<=[\s"'])disabled:pointer-events-none(?=[\s"'])/,
      );
    },
  );
});

describe("the stepper button variant", () => {
  it("rests muted and tints only the hovered arrow, with a pointer only while enabled", () => {
    expect(buttonVariants({ variant: "stepper" }).split(/\s+/)).toEqual(
      expect.arrayContaining([
        "text-muted-foreground",
        "hover:bg-primary/15",
        "hover:text-primary",
        "active:bg-primary/25",
        // `enabled:` so a disabled arrow keeps the base layer's not-allowed
        // cursor instead of a utility pointer that would beat it.
        "enabled:cursor-pointer",
      ]),
    );
    expect(buttonVariants({ variant: "stepper" })).not.toContain(
      " cursor-pointer",
    );
  });
});
