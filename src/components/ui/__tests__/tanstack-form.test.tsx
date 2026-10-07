import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { FieldErrors, fieldErrorMessage } from "@/components/ui/tanstack-form";

/**
 * A one-field form: `name` must not be empty. The field's message as
 * `fieldErrorMessage` reports it ("none" for null) sits next to what
 * `FieldErrors` renders, so the two can be compared.
 */
function NameForm({ validator }: { validator: "string" | "schema" }) {
  const form = useForm({
    defaultValues: { name: "" },
    validators:
      validator === "schema"
        ? { onChange: z.object({ name: z.string().min(1, "Name is required.") }) }
        : undefined,
  });
  return (
    <form.Field
      name="name"
      validators={
        validator === "string"
          ? { onChange: ({ value }) => (value ? undefined : "Enter a name.") }
          : undefined
      }
    >
      {(field) => (
        <>
          <input
            aria-label="Name"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => {
              field.handleChange(event.target.value);
            }}
          />
          <output aria-label="Message">{fieldErrorMessage(field) ?? "none"}</output>
          <FieldErrors field={field} />
          <button
            type="button"
            onClick={() => {
              void form.handleSubmit();
            }}
          >
            Submit
          </button>
        </>
      )}
    </form.Field>
  );
}

function message() {
  return screen.getByRole("status", { name: "Message" }).textContent;
}

describe("fieldErrorMessage", () => {
  it("reports nothing while the field is valid", async () => {
    const user = userEvent.setup();
    render(<NameForm validator="string" />);

    await user.type(screen.getByRole("textbox", { name: "Name" }), "Ada");

    expect(message()).toBe("none");
  });

  it("reports a string error once the user has touched the field", async () => {
    const user = userEvent.setup();
    render(<NameForm validator="string" />);
    expect(message()).toBe("none");

    await user.type(screen.getByRole("textbox", { name: "Name" }), "A");
    await user.clear(screen.getByRole("textbox", { name: "Name" }));

    expect(message()).toBe("Enter a name.");
    expect(screen.getByText("Enter a name.", { selector: "p" })).toBeVisible();
  });

  it("reports a schema issue's message after a submit attempt", async () => {
    const user = userEvent.setup();
    render(<NameForm validator="schema" />);

    await user.click(screen.getByRole("button", { name: "Submit" }));

    expect(message()).toBe("Name is required.");
    expect(
      screen.getByText("Name is required.", { selector: "p" }),
    ).toBeVisible();
  });
});
