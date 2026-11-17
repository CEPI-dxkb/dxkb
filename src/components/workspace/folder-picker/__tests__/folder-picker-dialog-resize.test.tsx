import { fireEvent, screen, waitFor } from "@testing-library/react";
import { readStorageItem, writeStorageItem } from "@/lib/browser-storage";
import { pickerLayoutKey } from "../folder-picker-layout";
import {
  findOption,
  pickerUser,
  renderPicker,
  stubPickerBrowserApis,
} from "./fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: pickerUser }),
}));

stubPickerBrowserApis();

function dialogWidthHandle() {
  return screen.getByRole("separator", { name: "Resize dialog width" });
}

function cornerGrip() {
  const grip = document.querySelector('[data-slot="picker-resize-grip"]');
  if (!grip) throw new Error("The corner grip is not rendered");
  return grip;
}

function sizeVars() {
  const dialog = screen.getByRole("dialog");
  return {
    width: dialog.style.getPropertyValue("--picker-width"),
    height: dialog.style.getPropertyValue("--picker-height"),
  };
}

function storedLayout(): unknown {
  return JSON.parse(readStorageItem(pickerLayoutKey) ?? "{}");
}

describe("resizable picker dialog", () => {
  beforeEach(() => {
    vi.stubGlobal("innerWidth", 1600);
    vi.stubGlobal("innerHeight", 900);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens at the default size", async () => {
    renderPicker();
    await findOption("Home", "Experiments");

    expect(sizeVars()).toEqual({ width: "1280px", height: "672px" });
    expect(dialogWidthHandle()).toHaveAttribute("aria-valuenow", "1280");
    expect(dialogWidthHandle()).toHaveAttribute("aria-valuemin", "720");
    expect(dialogWidthHandle()).toHaveAttribute("aria-valuemax", "1568");
  });

  it("widens with the arrow keys and remembers it for the next open", async () => {
    const { user, reopen } = renderPicker();
    await findOption("Home", "Experiments");

    dialogWidthHandle().focus();
    await user.keyboard("{ArrowRight}");

    expect(sizeVars().width).toBe("1312px");
    expect(storedLayout()).toEqual({ dialog: { width: 1312, height: 672 } });

    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await reopen();
    await findOption("Home", "Experiments");
    expect(sizeVars().width).toBe("1312px");
  });

  it("follows a drag of the right edge at twice the pointer travel", async () => {
    renderPicker();
    await findOption("Home", "Experiments");

    fireEvent.pointerDown(dialogWidthHandle(), {
      button: 0,
      clientX: 800,
      pointerId: 1,
    });
    fireEvent.pointerMove(dialogWidthHandle(), { clientX: 850, pointerId: 1 });

    expect(sizeVars().width).toBe("1380px");
  });

  it("returns to the default size on double click and stores nothing", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    dialogWidthHandle().focus();
    await user.keyboard("{ArrowRight}");

    await user.dblClick(dialogWidthHandle());

    expect(sizeVars().width).toBe("1280px");
    expect(readStorageItem(pickerLayoutKey)).toBeNull();
  });

  it("clamps to a smaller window and reports the size it really has", async () => {
    vi.stubGlobal("innerWidth", 1000);
    renderPicker();
    await findOption("Home", "Experiments");

    expect(sizeVars().width).toBe("968px");
    expect(dialogWidthHandle()).toHaveAttribute("aria-valuenow", "968");
    expect(dialogWidthHandle()).toHaveAttribute("aria-valuemax", "968");
  });

  it("resets to the true default on a narrow window instead of storing the clamped width", async () => {
    vi.stubGlobal("innerWidth", 1000);
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    dialogWidthHandle().focus();
    await user.keyboard("{ArrowLeft}");
    expect(storedLayout()).toEqual({ dialog: { width: 936, height: 672 } });

    await user.dblClick(dialogWidthHandle());

    expect(sizeVars().width).toBe("968px");
    expect(readStorageItem(pickerLayoutKey)).toBeNull();
  });

  it("keeps a taller stored height when the width changes on a short window", async () => {
    vi.stubGlobal("innerHeight", 700);
    writeStorageItem(
      pickerLayoutKey,
      JSON.stringify({ dialog: { width: 1280, height: 900 } }),
    );
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    expect(sizeVars().height).toBe("668px");

    dialogWidthHandle().focus();
    await user.keyboard("{ArrowRight}");
    expect(storedLayout()).toEqual({ dialog: { width: 1312, height: 900 } });

    await user.dblClick(dialogWidthHandle());
    expect(storedLayout()).toEqual({ dialog: { width: 1280, height: 900 } });
  });

  it("offers Expand at the default size even when the window is too small for it to grow", async () => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 700);
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    expect(sizeVars()).toEqual({ width: "968px", height: "668px" });

    await user.click(screen.getByRole("button", { name: "Expand dialog" }));
    expect(storedLayout()).toEqual({ dialog: { width: 968, height: 668 } });

    await user.click(
      screen.getByRole("button", { name: "Restore dialog size" }),
    );
    expect(readStorageItem(pickerLayoutKey)).toBeNull();
  });

  it("expands to the window and restores", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Experiments");

    await user.click(screen.getByRole("button", { name: "Expand dialog" }));
    expect(sizeVars()).toEqual({ width: "1568px", height: "868px" });

    await user.click(
      screen.getByRole("button", { name: "Restore dialog size" }),
    );
    expect(sizeVars()).toEqual({ width: "1280px", height: "672px" });
    expect(readStorageItem(pickerLayoutKey)).toBeNull();
  });

  it("resizes both axes from the corner grip, which stays out of the accessibility tree", async () => {
    renderPicker();
    await findOption("Home", "Experiments");
    const grip = cornerGrip();
    expect(grip).toHaveAttribute("aria-hidden", "true");

    fireEvent.pointerDown(grip, {
      button: 0,
      clientX: 800,
      clientY: 500,
      pointerId: 2,
    });
    fireEvent.pointerMove(grip, { clientX: 850, clientY: 550, pointerId: 2 });

    expect(sizeVars()).toEqual({ width: "1380px", height: "772px" });
    expect(storedLayout()).toEqual({ dialog: { width: 1380, height: 772 } });

    fireEvent.pointerUp(grip, { clientX: 850, clientY: 550, pointerId: 2 });
    fireEvent.pointerMove(grip, { clientX: 900, clientY: 600, pointerId: 2 });
    expect(sizeVars()).toEqual({ width: "1380px", height: "772px" });
  });

  it("remembers column and info-pane widths in storage", async () => {
    const { user } = renderPicker();
    await findOption("Home", "Experiments");

    screen.getByRole("separator", { name: "Resize Home column" }).focus();
    await user.keyboard("{ArrowRight}");
    screen.getByRole("separator", { name: "Resize info pane" }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(storedLayout()).toEqual({ columns: { 0: 256 }, preview: 336 });
  });
});
