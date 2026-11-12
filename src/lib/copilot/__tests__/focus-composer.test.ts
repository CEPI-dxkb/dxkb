import { focusComposerWhenReady } from "../focus-composer";

function composerBox() {
  const box = document.createElement("textarea");
  box.setAttribute("data-copilot-composer", "");
  return box;
}

function surface(textarea?: { disabled: boolean }) {
  const container = document.createElement("div");
  document.body.append(container);
  let box: HTMLTextAreaElement | null = null;
  if (textarea) {
    box = composerBox();
    box.disabled = textarea.disabled;
    container.append(box);
  }
  return { container, box };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("focusComposerWhenReady", () => {
  it("focuses an enabled composer at once", () => {
    const { container, box } = surface({ disabled: false });
    focusComposerWhenReady(container);
    expect(box).toHaveFocus();
  });

  it("waits for a composer that is still disabled or not yet loaded", async () => {
    const { container, box } = surface({ disabled: true });
    focusComposerWhenReady(container);
    expect(box).not.toHaveFocus();
    if (box) box.disabled = false;
    await vi.waitFor(() => {
      expect(box).toHaveFocus();
    });

    const late = surface();
    focusComposerWhenReady(late.container);
    const loaded = composerBox();
    late.container.append(loaded);
    await vi.waitFor(() => {
      expect(loaded).toHaveFocus();
    });
  });

  it("skips another textarea in the chat, such as a plan step being edited", () => {
    const { container, box } = surface({ disabled: false });
    const step = document.createElement("textarea");
    container.prepend(step);
    focusComposerWhenReady(container);
    expect(step).not.toHaveFocus();
    expect(box).toHaveFocus();
  });

  it("gives up when the user has focused something else meanwhile", async () => {
    const { container, box } = surface({ disabled: true });
    const elsewhere = document.createElement("input");
    document.body.append(elsewhere);
    focusComposerWhenReady(container);
    elsewhere.focus();
    if (box) box.disabled = false;
    await Promise.resolve();
    expect(elsewhere).toHaveFocus();
  });

  it("stops waiting when cleaned up", async () => {
    const { container, box } = surface({ disabled: true });
    const stop = focusComposerWhenReady(container);
    stop();
    if (box) box.disabled = false;
    await Promise.resolve();
    expect(box).not.toHaveFocus();
  });
});
