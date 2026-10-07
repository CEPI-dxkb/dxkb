import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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

const home = "/alice@bvbrc/home";

function renderOutputFolder(value = "") {
  const repository = new InMemoryWorkspaceRepository({
    directories: {
      [home]: [
        { name: "Alpha", type: "folder" },
        { name: ".hidden", type: "folder" },
      ],
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
  render(<OutputFolder value={value} onChange={onChange} />, {
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
    await user.click(await screen.findByText("Alpha"));
    await user.click(screen.getByRole("button", { name: "Select" }));

    expect(onChange).toHaveBeenCalledWith(`${home}/Alpha`);
  });

  it("keeps hidden folders out of the picker's choices", async () => {
    const { user } = renderOutputFolder();

    await user.click(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    );
    await user.click(
      await screen.findByRole("checkbox", {
        name: "Show all files and folders",
      }),
    );
    await user.dblClick(await screen.findByText(".hidden"));

    expect(
      await screen.findByText("This folder can't be used here."),
    ).toBeInTheDocument();
  });

  it("disables browsing when signed out", () => {
    authState.user = null;
    renderOutputFolder();

    expect(
      screen.getByRole("button", { name: "Browse workspace folders" }),
    ).toBeDisabled();
  });
});
