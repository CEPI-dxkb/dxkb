import type { ComponentProps, ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OutputFolder from "@/components/services/output-folder";
import { WorkspaceRepositoryProvider } from "@/contexts/workspace-repository-context";
import { InMemoryWorkspaceRepository } from "@/lib/services/workspace/adapters/in-memory-workspace-repository";
import { createQueryClientWrapper } from "@/test-helpers/react";

interface TestUser {
  id: string;
  realm: string;
}

const { authState } = vi.hoisted(() => ({
  authState: { user: null as TestUser | null },
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => authState,
}));

vi.mock("@/hooks/services/workspace/use-workspace-object-search", () => ({
  useWorkspaceObjectSearch: () => ({
    objects: [],
    filteredObjects: [],
    loading: false,
    error: null,
    searchQuery: "",
    setSearchQuery: vi.fn(),
    search: vi.fn(),
  }),
}));

Element.prototype.scrollIntoView = vi.fn();
// jsdom has no element scrolling; reduced motion skips the picker's animations.
Element.prototype.scrollTo = vi.fn();
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();
Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: () => ({ matches: true }),
});

const home = "/alice@bvbrc/home";

function renderOutputFolder(
  value = "",
  props: Partial<ComponentProps<typeof OutputFolder>> = {},
) {
  const repository = new InMemoryWorkspaceRepository({
    directories: {
      [home]: [
        { name: "Alpha", type: "folder" },
        { name: ".hidden", type: "folder" },
      ],
      [`${home}/Alpha`]: [],
      [`${home}/.hidden`]: [{ name: "sub", type: "folder" }],
    },
  });
  const QueryWrapper = createQueryClientWrapper();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <WorkspaceRepositoryProvider
          value={{ authenticated: repository, public: repository }}
        >
          {children}
        </WorkspaceRepositoryProvider>
      </QueryWrapper>
    );
  }
  const onChange = vi.fn();
  render(<OutputFolder value={value} onChange={onChange} {...props} />, {
    wrapper: Wrapper,
  });
  return { onChange, user: userEvent.setup() };
}

beforeEach(() => {
  authState.user = { id: "alice", realm: "bvbrc" };
});

describe("OutputFolder browse dialog", () => {
  it("sets the output folder from the workspace picker", async () => {
    const { onChange, user } = renderOutputFolder();

    await user.click(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Select an Output Folder" }),
    ).toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "Alpha" }));
    await user.click(screen.getByRole("button", { name: "Select “Alpha”" }));

    expect(onChange).toHaveBeenCalledWith(`${home}/Alpha`);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens the picker on the folder already in the field", async () => {
    const { user } = renderOutputFolder(`${home}/Alpha`);

    await user.click(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    );

    expect(await screen.findByRole("option", { name: "Alpha" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Select “Alpha”" }),
    ).toBeEnabled();
  });

  it("leaves the field alone when the picker is cancelled", async () => {
    const { onChange, user } = renderOutputFolder(`${home}/Alpha`);
    await user.click(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    );
    await screen.findByRole("option", { name: "Alpha" });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("refuses a folder inside a hidden folder", async () => {
    const { user } = renderOutputFolder(`${home}/.hidden/sub`);

    await user.click(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    );

    expect(
      await screen.findByText("This folder can't be used here."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select “sub”" }),
    ).toBeDisabled();
  });

  it("keeps hidden folders out of the picker's choices", async () => {
    const { user } = renderOutputFolder(`${home}/.hidden`);

    await user.click(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    );
    await screen.findByRole("option", { name: "Alpha" });
    await user.click(screen.getByRole("button", { name: "Show files" }));

    expect(screen.queryByRole("option", { name: ".hidden" })).toBeNull();
    expect(
      screen.getByText("This folder can't be used here."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Select/ })).toBeDisabled();
  });

  it("disables browsing while the field is disabled", () => {
    renderOutputFolder("", { disabled: true });

    expect(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    ).toBeDisabled();
  });

  it("has no browse button for an output name", () => {
    renderOutputFolder("", { variant: "name" });

    expect(
      screen.queryByRole("button", { name: "Browse workspace folders" }),
    ).not.toBeInTheDocument();
  });

  it("disables browsing when signed out", () => {
    authState.user = null;
    renderOutputFolder();

    expect(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    ).toBeDisabled();
  });
});
