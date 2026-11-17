import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { readStorageItem, writeStorageItem } from "@/lib/browser-storage";
import { pickerLayoutKey } from "../folder-picker-layout";
import {
  defaultPickerDirectories,
  findOption,
  makePickerRepository,
  pickerHome,
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

  it("sets its size without a transition, so a drag does not glide behind the pointer", async () => {
    renderPicker();
    await findOption("Home", "Experiments");

    // The width and height come from CSS variables, and the base popup's `duration-100`
    // alone leaves `transition-property: all`, so without the `resize="live"` variant's
    // `transition-none` every resize would glide for 100ms. Open and close are keyframe
    // animations: they must stay.
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("transition-none");
    expect(dialog).toHaveClass(
      "data-open:animate-in",
      "data-closed:animate-out",
      "data-open:zoom-in-95",
      "data-closed:fade-out-0",
      "duration-100",
    );
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

  it("offers no Expand where the dialog already fills the window, and stores nothing", async () => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 700);
    renderPicker();
    await findOption("Home", "Experiments");
    expect(sizeVars()).toEqual({ width: "968px", height: "668px" });

    // Expand would store 968 x 668, which a later, larger window would open below the
    // 1280 x 672 default.
    expect(
      screen.queryByRole("button", { name: "Expand dialog" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Restore dialog size" }),
    ).not.toBeInTheDocument();
    expect(readStorageItem(pickerLayoutKey)).toBeNull();
  });

  it("offers Expand on a window where only the height grows", async () => {
    vi.stubGlobal("innerWidth", 1280);
    vi.stubGlobal("innerHeight", 720);
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    expect(sizeVars()).toEqual({ width: "1248px", height: "672px" });

    await user.click(screen.getByRole("button", { name: "Expand dialog" }));
    expect(sizeVars()).toEqual({ width: "1248px", height: "688px" });
    // The window shows the width clamped, but the stored one stays the 1280 default.
    expect(storedLayout()).toEqual({ dialog: { width: 1280, height: 688 } });
    expect(
      screen.getByRole("button", { name: "Restore dialog size" }),
    ).toBeInTheDocument();
  });

  it("does not leave a window-clamped width behind when Expand grows only the height", async () => {
    vi.stubGlobal("innerWidth", 1280);
    vi.stubGlobal("innerHeight", 720);
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    await user.click(screen.getByRole("button", { name: "Expand dialog" }));

    vi.stubGlobal("innerWidth", 1600);
    vi.stubGlobal("innerHeight", 900);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(sizeVars()).toEqual({ width: "1280px", height: "688px" });
    expect(
      screen.getByRole("button", { name: "Expand dialog" }),
    ).toBeInTheDocument();
  });

  it("keeps a remembered width the window cannot show when Expand grows the height", async () => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 700);
    writeStorageItem(
      pickerLayoutKey,
      JSON.stringify({ dialog: { width: 1500, height: 500 } }),
    );
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    expect(sizeVars()).toEqual({ width: "968px", height: "500px" });

    await user.click(screen.getByRole("button", { name: "Expand dialog" }));

    expect(sizeVars()).toEqual({ width: "968px", height: "668px" });
    expect(storedLayout()).toEqual({ dialog: { width: 1500, height: 668 } });
  });

  it("keeps Restore for a stored expanded size on a window that cannot grow it", async () => {
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 700);
    writeStorageItem(
      pickerLayoutKey,
      JSON.stringify({ dialog: { width: 1568, height: 868 } }),
    );
    const { user } = renderPicker();
    await findOption("Home", "Experiments");
    expect(sizeVars()).toEqual({ width: "968px", height: "668px" });

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

  describe("on a window smaller than the remembered size", () => {
    // The dialog renders clamped to the window, but a resize must not write that clamped
    // value for an axis it did not visibly change, or a later, larger window loses it.
    function dragCorner(
      moves: readonly (readonly [x: number, y: number])[],
      from: readonly [x: number, y: number] = [800, 500],
    ) {
      const grip = cornerGrip();
      fireEvent.pointerDown(grip, {
        button: 0,
        clientX: from[0],
        clientY: from[1],
        pointerId: 3,
      });
      for (const [x, y] of moves) {
        fireEvent.pointerMove(grip, { clientX: x, clientY: y, pointerId: 3 });
      }
      fireEvent.pointerUp(grip, { pointerId: 3 });
    }

    it("keeps the remembered width when the corner grip only moves the height", async () => {
      vi.stubGlobal("innerWidth", 1000);
      writeStorageItem(
        pickerLayoutKey,
        JSON.stringify({ dialog: { width: 1500, height: 800 } }),
      );
      renderPicker();
      await findOption("Home", "Experiments");
      expect(sizeVars()).toEqual({ width: "968px", height: "800px" });

      dragCorner([[800, 520]]);

      expect(sizeVars()).toEqual({ width: "968px", height: "840px" });
      expect(storedLayout()).toEqual({ dialog: { width: 1500, height: 840 } });
    });

    it("keeps the remembered height when the corner grip only moves the width", async () => {
      vi.stubGlobal("innerHeight", 700);
      writeStorageItem(
        pickerLayoutKey,
        JSON.stringify({ dialog: { width: 1280, height: 900 } }),
      );
      renderPicker();
      await findOption("Home", "Experiments");
      expect(sizeVars()).toEqual({ width: "1280px", height: "668px" });

      dragCorner([[820, 500]]);

      expect(sizeVars()).toEqual({ width: "1320px", height: "668px" });
      expect(storedLayout()).toEqual({ dialog: { width: 1320, height: 900 } });
    });

    it("still stores the new clamped value for an axis the corner grip changes", async () => {
      vi.stubGlobal("innerWidth", 1000);
      vi.stubGlobal("innerHeight", 900);
      renderPicker();
      await findOption("Home", "Experiments");

      // 20px left narrows to 928; 500px down is clamped to the 868 the window allows.
      dragCorner([[780, 1000]]);

      expect(sizeVars()).toEqual({ width: "928px", height: "868px" });
      expect(storedLayout()).toEqual({ dialog: { width: 928, height: 868 } });
    });

    it("restores the remembered value of an axis dragged away and back to where it began", async () => {
      vi.stubGlobal("innerWidth", 1000);
      writeStorageItem(
        pickerLayoutKey,
        JSON.stringify({ dialog: { width: 1500, height: 800 } }),
      );
      renderPicker();
      await findOption("Home", "Experiments");

      dragCorner([[780, 500], [800, 500]]);

      expect(sizeVars()).toEqual({ width: "968px", height: "800px" });
      expect(storedLayout()).toEqual({ dialog: { width: 1500, height: 800 } });
    });

    it("stores nothing when the width separator is pressed at the window's maximum", async () => {
      vi.stubGlobal("innerWidth", 1000);
      const { user } = renderPicker();
      await findOption("Home", "Experiments");
      expect(dialogWidthHandle()).toHaveAttribute("aria-valuenow", "968");

      dialogWidthHandle().focus();
      await user.keyboard("{ArrowRight}");

      expect(readStorageItem(pickerLayoutKey)).toBeNull();
    });

    it("keeps the remembered size when the width separator is pressed at the window's maximum", async () => {
      vi.stubGlobal("innerWidth", 1000);
      vi.stubGlobal("innerHeight", 900);
      writeStorageItem(
        pickerLayoutKey,
        JSON.stringify({ dialog: { width: 1500, height: 800 } }),
      );
      const { user } = renderPicker();
      await findOption("Home", "Experiments");

      dialogWidthHandle().focus();
      await user.keyboard("{ArrowRight}");

      expect(storedLayout()).toEqual({ dialog: { width: 1500, height: 800 } });
    });
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

  it("resizes a column nine folders deep and remembers it", async () => {
    const directories = { ...defaultPickerDirectories };
    let path = pickerHome;
    for (let level = 1; level <= 9; level += 1) {
      directories[path] = [
        ...(directories[path] ?? []),
        { name: `L${String(level)}`, type: "folder" },
      ];
      path = `${path}/L${String(level)}`;
    }
    directories[path] = [];
    const { user } = renderPicker(
      { initialPath: path },
      makePickerRepository({ directories }),
    );

    // The picker moves focus to the open folder once it loads; a handle focused earlier
    // would lose it.
    const open = await findOption("L8", "L9");
    await waitFor(() => {
      expect(open).toHaveFocus();
    });
    const handle = screen.getByRole("separator", { name: "Resize L9 column" });
    expect(handle).toHaveAttribute("aria-valuenow", "180");

    handle.focus();
    await user.keyboard("{ArrowRight}");

    expect(handle).toHaveAttribute("aria-valuenow", "196");
    expect(storedLayout()).toEqual({ columns: { 9: 196 } });
  });
});
