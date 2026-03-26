import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkspaceItemDetails } from "../workspace-item-details";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

vi.mock("@/lib/services/workspace/helpers", () => ({
  formatDate: vi.fn((d: string) => d || ""),
  formatOwner: vi.fn((id: string) => id || "—"),
}));

vi.mock("@/lib/services/workspace/client", () => ({
  WorkspaceApiClient: function WorkspaceApiClient() { return; },
}));

vi.mock("@/lib/services/workspace/methods/crud", () => ({
  WorkspaceCrudMethods: function WorkspaceCrudMethods() {
    return { updateObjectType: vi.fn() };
  },
}));

vi.mock("@/lib/services/workspace/types", () => ({
  editTypeOptions: ["contigs", "reads", "csv", "txt", "json"],
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <div data-testid="select" data-value={value}>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/components/detail-panel", () => ({
  DetailPanel: {
    CollapsibleSection: ({
      children,
      label,
    }: {
      children: React.ReactNode;
      label: string;
    }) => (
      <div data-testid="collapsible-section" data-label={label}>
        {children}
      </div>
    ),
  },
}));

vi.mock("@/components/workspace/workspace-item-icon", () => ({
  WorkspaceItemIcon: () => <span data-testid="item-icon" />,
}));

const makeItem = (overrides?: Partial<WorkspaceBrowserItem>): WorkspaceBrowserItem =>
  ({
    id: "id-1",
    path: "/user/home/data.fasta",
    name: "data.fasta",
    type: "contigs",
    size: 1024,
    creation_time: "2024-01-01",
    owner_id: "user@bvbrc",
    ...overrides,
  }) as WorkspaceBrowserItem;

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe("WorkspaceItemDetails", () => {
  it("renders the item owner", () => {
    renderWithQueryClient(<WorkspaceItemDetails item={makeItem()} />);
    expect(screen.getByText("user@bvbrc")).toBeInTheDocument();
  });

  it("renders the creation date", () => {
    renderWithQueryClient(
      <WorkspaceItemDetails item={makeItem({ creation_time: "2024-06-15" })} />,
    );
    expect(screen.getByText("2024-06-15")).toBeInTheDocument();
  });

  it("renders the item path", () => {
    renderWithQueryClient(<WorkspaceItemDetails item={makeItem()} />);
    expect(screen.getByText("/user/home/data.fasta")).toBeInTheDocument();
  });

  it("renders children inside the details section", () => {
    renderWithQueryClient(
      <WorkspaceItemDetails item={makeItem()}>
        <div data-testid="custom-detail">Extra info</div>
      </WorkspaceItemDetails>,
    );
    expect(screen.getByTestId("custom-detail")).toBeInTheDocument();
  });

  it("includes current type in options even if not in editTypeOptions", () => {
    renderWithQueryClient(
      <WorkspaceItemDetails item={makeItem({ type: "custom_rare_type" })} />,
    );
    const section = screen.getByTestId("collapsible-section");
    expect(section).toBeInTheDocument();
    // The custom type should appear as a select option
    expect(screen.getByText("custom_rare_type")).toBeInTheDocument();
  });

  it("renders a collapsible section with label 'Details'", () => {
    renderWithQueryClient(<WorkspaceItemDetails item={makeItem()} />);
    expect(screen.getByTestId("collapsible-section")).toHaveAttribute(
      "data-label",
      "Details",
    );
  });
});
