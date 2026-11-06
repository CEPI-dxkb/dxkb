import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import {
  CopilotComposer,
  type CopilotComposerProps,
} from "@/components/copilot/copilot-composer";
import type { CopilotAttachment } from "@/lib/copilot/attachments";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

const png = new File(["x"], "a.png", { type: "image/png" });

function attachment(id: string): CopilotAttachment {
  return { id, name: `${id}.txt`, kind: "file" } as CopilotAttachment;
}

function renderComposer(props: Partial<CopilotComposerProps> = {}) {
  const onAttach = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <CopilotComposer
      value="hello"
      onChange={vi.fn()}
      onSubmit={onSubmit}
      onStop={vi.fn()}
      running={false}
      disabled={false}
      executionMode="plan"
      onExecutionModeChange={vi.fn()}
      attachments={[]}
      onAttach={onAttach}
      onRemoveAttachment={vi.fn()}
      {...props}
    />,
  );
  return { ...utils, onAttach, onSubmit };
}

function fileDrag(type: "dragOver" | "drop", form: Element) {
  const event = createEvent[type](form, {
    dataTransfer: { types: ["Files"], files: [png], dropEffect: "" },
  });
  fireEvent(form, event);
  return event;
}

function paste(files: File[], text: string) {
  const box = screen.getByRole("textbox", { name: "Ask AskClark" });
  const event = createEvent.paste(box, {
    clipboardData: { files, getData: () => text },
  });
  fireEvent(box, event);
  return event;
}

describe("CopilotComposer file drag and paste", () => {
  it.each([
    ["disabled", { disabled: true }],
    [
      "full",
      { attachments: [attachment("a"), attachment("b"), attachment("c")] },
    ],
  ])("cancels a file drag and does not attach when %s", (_name, props) => {
    const { container, onAttach } = renderComposer(props);
    const form = container.querySelector("form") as HTMLFormElement;
    expect(fileDrag("dragOver", form).defaultPrevented).toBe(true);
    expect(fileDrag("drop", form).defaultPrevented).toBe(true);
    expect(onAttach).not.toHaveBeenCalled();
  });

  it("attaches a dropped file when allowed", () => {
    const { container, onAttach } = renderComposer();
    const form = container.querySelector("form") as HTMLFormElement;
    const over = fileDrag("dragOver", form);
    expect(over.defaultPrevented).toBe(true);
    expect(form).toHaveAttribute("data-dragging");
    fileDrag("drop", form);
    expect(onAttach).toHaveBeenCalledWith([png]);
  });

  it("attaches a pasted file beside text without cancelling the paste", () => {
    const { onAttach } = renderComposer();
    expect(paste([png], "cell text").defaultPrevented).toBe(false);
    expect(onAttach).toHaveBeenCalledWith([png]);
  });

  it("cancels the paste when its text is only the file names (Finder)", () => {
    const { onAttach } = renderComposer();
    const notes = new File(["y"], "notes.txt", { type: "text/plain" });
    expect(paste([png], "a.png").defaultPrevented).toBe(true);
    expect(paste([png, notes], "notes.txt\na.png").defaultPrevented).toBe(true);
    expect(paste([png], "a.png and more").defaultPrevented).toBe(false);
    expect(onAttach).toHaveBeenCalledTimes(3);
  });

  it("attaches a pasted file alone and cancels the paste", () => {
    const { onAttach } = renderComposer();
    expect(paste([png], "").defaultPrevented).toBe(true);
    expect(onAttach).toHaveBeenCalledWith([png]);
  });

  it("blocks submit while files are being read", () => {
    const { onSubmit } = renderComposer({ reading: true });
    expect(screen.getByRole("button", { name: "Attach files" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits when nothing is being read", () => {
    const { onSubmit } = renderComposer();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
