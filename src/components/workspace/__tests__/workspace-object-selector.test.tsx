import { useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { WorkspaceObjectSelector } from "../workspace-object-selector";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { AuthBoundary } from "@/lib/auth/provider";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { testAuthUser } from "@/test-helpers/react";

function Providers({ children }: { children: ReactNode }) {
  const repo = new InMemoryWorkspaceRepository({
    directories: {
      "/testuser@bvbrc/home": [
        { name: "Group A", type: "genome_group" },
        { name: "Group B", type: "genome_group" },
      ],
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBoundary user={testAuthUser}>
        <WorkspaceRepositoryProvider
          value={{ authenticated: repo, public: repo }}
        >
          {children}
        </WorkspaceRepositoryProvider>
      </AuthBoundary>
    </QueryClientProvider>
  );
}

/** A parent that holds the pick as `value`, as the service forms do. */
function ControlledSelector({ invalid }: { invalid?: boolean }) {
  const [value, setValue] = useState<string>();
  return (
    <>
      <WorkspaceObjectSelector
        placeholder="Select group"
        value={value}
        invalid={invalid}
        onSelectedObjectChange={(object) => {
          setValue(object?.path);
        }}
      />
      <output aria-label="Picked path">{value ?? ""}</output>
      <button
        type="button"
        onClick={() => {
          setValue(undefined);
        }}
      >
        Reset
      </button>
    </>
  );
}

async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: "Show suggestions" }));
  await user.click(
    await screen.findByRole("option", { name: new RegExp(name) }),
  );
  await waitFor(() => {
    expect(screen.getByLabelText("Picked path")).toHaveTextContent(name);
  });
}

describe("WorkspaceObjectSelector", () => {
  it("keeps the text typed over a pick when the parent clears its value", async () => {
    const user = userEvent.setup();
    render(<ControlledSelector />, { wrapper: Providers });
    await pick(user, "Group A");

    const input = screen.getByPlaceholderText("Select group");
    await user.type(input, "x");

    expect(screen.getByLabelText("Picked path")).toHaveTextContent("");
    await waitFor(() => {
      expect(input).toHaveValue("Group Ax");
    });
  });

  it("empties the box when the parent clears the value itself", async () => {
    const user = userEvent.setup();
    render(<ControlledSelector />, { wrapper: Providers });
    await pick(user, "Group A");

    await user.click(screen.getByRole("button", { name: "Reset" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Select group")).toHaveValue("");
    });
  });

  it("draws its error state from `invalid`", () => {
    const { rerender } = render(<ControlledSelector />, { wrapper: Providers });
    const input = screen.getByPlaceholderText("Select group");
    expect(input).not.toHaveAttribute("aria-invalid");

    rerender(<ControlledSelector invalid />);
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  async function pickWithKeyboard(
    user: ReturnType<typeof userEvent.setup>,
    name: string,
  ) {
    const input = screen.getByPlaceholderText("Select group");
    await user.type(input, name);
    await screen.findByRole("option", { name: new RegExp(name) });
    await user.keyboard("{ArrowDown}{Enter}");
    return input;
  }

  it("keeps a direct pick when Enter is pressed again", async () => {
    const user = userEvent.setup();
    render(<ControlledSelector />, { wrapper: Providers });
    const input = await pickWithKeyboard(user, "Group A");
    await waitFor(() => {
      expect(screen.getByLabelText("Picked path")).toHaveTextContent("Group A");
    });

    await user.keyboard("{Enter}");

    expect(screen.getByLabelText("Picked path")).toHaveTextContent("Group A");
    expect(input).toHaveValue("Group A");
  });

  it("still commits a staged pick on Enter when the caller adds on select", async () => {
    const onObjectSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <WorkspaceObjectSelector
        placeholder="Select group"
        onObjectSelect={onObjectSelect}
        onSelectedObjectChange={vi.fn()}
      />,
      { wrapper: Providers },
    );
    await pickWithKeyboard(user, "Group A");
    expect(onObjectSelect).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");

    expect(onObjectSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Group A" }),
    );
  });
});

describe("WorkspaceObjectSelector searchOnInteraction", () => {
  const home = "/testuser@bvbrc/home";

  function renderFolderSelector({
    searchOnInteraction,
    value,
  }: {
    searchOnInteraction: boolean;
    value?: string;
  }) {
    const repo = new InMemoryWorkspaceRepository({
      directories: {
        [home]: [
          { name: "Genome Groups", type: "folder" },
          { name: "Other", type: "folder" },
        ],
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthBoundary user={testAuthUser}>
          <WorkspaceRepositoryProvider
            value={{ authenticated: repo, public: repo }}
          >
            <WorkspaceObjectSelector
              preset="folder"
              placeholder="Search for folders..."
              value={value}
              browse={false}
              searchOnInteraction={searchOnInteraction}
              onSelectedObjectChange={vi.fn()}
            />
          </WorkspaceRepositoryProvider>
        </AuthBoundary>
      </QueryClientProvider>,
    );
    return {
      user: userEvent.setup(),
      searchCount: () =>
        repo.calls.filter((call) => call.method === "searchObjects").length,
    };
  }

  it("searches on mount by default", async () => {
    const { searchCount } = renderFolderSelector({
      searchOnInteraction: false,
      value: `${home}/Genome Groups`,
    });
    expect(await screen.findByDisplayValue("Genome Groups")).toBeVisible();
    expect(searchCount()).toBe(1);
  });

  it("names the value from its path without searching until the field is focused", async () => {
    const { user, searchCount } = renderFolderSelector({
      searchOnInteraction: true,
      value: `${home}/Genome Groups`,
    });
    expect(await screen.findByDisplayValue("Genome Groups")).toBeVisible();
    expect(searchCount()).toBe(0);

    await user.click(screen.getByPlaceholderText("Search for folders..."));

    await waitFor(() => {
      expect(searchCount()).toBe(1);
    });
    expect(screen.getByPlaceholderText("Search for folders...")).toHaveValue(
      "Genome Groups",
    );
  });

  it("searches once the suggestions are opened", async () => {
    const { user, searchCount } = renderFolderSelector({
      searchOnInteraction: true,
    });
    expect(searchCount()).toBe(0);

    await user.click(screen.getByRole("button", { name: "Show suggestions" }));

    expect(
      await screen.findByRole("option", { name: /Other/ }),
    ).toBeInTheDocument();
    expect(searchCount()).toBe(1);
  });
});
