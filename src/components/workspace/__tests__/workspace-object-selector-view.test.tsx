import { createRef, type RefObject } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceObjectSelectorView } from "../workspace-object-selector-view";
import type { WorkspaceObject } from "@/lib/services/workspace/types";

function renderView(
  objects: WorkspaceObject[],
  overrides: Partial<
    React.ComponentProps<typeof WorkspaceObjectSelectorView>
  > = {},
) {
  const onObjectClick = vi.fn();
  const itemRefs = { current: [] } as RefObject<(HTMLButtonElement | null)[]>;
  const consoleError = vi.mocked(console.error);
  consoleError.mockClear();

  const renderResult = render(
    <WorkspaceObjectSelectorView
      placeholder="Search workspace objects"
      validationError={null}
      inputValue=""
      searchQuery=""
      objects={objects}
      loading={false}
      error={null}
      showDropdown
      highlightedIndex={-1}
      dropdownLayout={{
        openUpward: false,
        maxHeight: 640,
        rect: { top: 20, left: 20, width: 400 },
      }}
      inputRef={createRef<HTMLDivElement>()}
      inputElementRef={createRef<HTMLInputElement>()}
      dropdownRef={createRef<HTMLDivElement>()}
      itemRefs={itemRefs}
      onInputChange={vi.fn()}
      onInputFocus={vi.fn()}
      onInputKeyDown={vi.fn()}
      onToggleDropdown={vi.fn()}
      onObjectClick={onObjectClick}
      onObjectHighlight={vi.fn()}
      {...overrides}
    />,
  );

  return { consoleError, onObjectClick, ...renderResult };
}

describe("WorkspaceObjectSelectorView", () => {
  it("renders and selects distinct paths that share a backend id without key errors", () => {
    const objects = [
      {
        id: "shared-id",
        name: "first.fq",
        path: "/alice@bvbrc/home/first.fq",
        type: "reads",
        isDirectory: false,
      },
      {
        id: "shared-id",
        name: "second.fq",
        path: "/alice@bvbrc/home/second.fq",
        type: "reads",
        isDirectory: false,
      },
    ] satisfies WorkspaceObject[];
    const { consoleError, onObjectClick } = renderView(objects);

    expect(screen.getByRole("listbox")).toHaveClass("z-50");
    expect(screen.getByRole("option", { name: /first\.fq/i })).toBeVisible();
    expect(screen.getByRole("option", { name: /second\.fq/i })).toBeVisible();
    fireEvent.click(screen.getByRole("option", { name: /second\.fq/i }));
    expect(onObjectClick).toHaveBeenCalledWith(objects[1]);
    expect(
      consoleError.mock.calls.some((args) =>
        args.some(
          (arg) =>
            typeof arg === "string" &&
            arg.includes("Encountered two children with the same key"),
        ),
      ),
    ).toBe(false);
  });

  it("keeps option focus on the combobox and exposes only a rendered active option", () => {
    const objects = [
      {
        id: "object-id",
        name: "reads.fq",
        path: "/alice@bvbrc/home/reads.fq",
        type: "reads",
        isDirectory: false,
      },
    ] satisfies WorkspaceObject[];
    const { rerender } = renderView(objects, {
      listboxId: "workspace-listbox",
      highlightedIndex: 0,
    });

    expect(screen.getByRole("option")).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-activedescendant",
      "workspace-listbox-option-0",
    );

    rerender(
      <WorkspaceObjectSelectorView
        placeholder="Search workspace objects"
        validationError={null}
        inputValue=""
        searchQuery=""
        objects={objects}
        loading={false}
        error={null}
        showDropdown={false}
        highlightedIndex={0}
        dropdownLayout={{
          openUpward: false,
          maxHeight: 640,
          rect: { top: 20, left: 20, width: 400 },
        }}
        listboxId="workspace-listbox"
        inputRef={createRef<HTMLDivElement>()}
        inputElementRef={createRef<HTMLInputElement>()}
        dropdownRef={createRef<HTMLDivElement>()}
        itemRefs={{ current: [] }}
        onInputChange={vi.fn()}
        onInputFocus={vi.fn()}
        onInputKeyDown={vi.fn()}
        onToggleDropdown={vi.fn()}
        onObjectClick={vi.fn()}
        onObjectHighlight={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox")).not.toHaveAttribute(
      "aria-activedescendant",
    );
  });
});
