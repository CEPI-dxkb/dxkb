import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceActionBar } from "../workspace-action-bar";
import type { WorkspaceBrowserItem } from "@/types/workspace-browser";

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    ...rest
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    [key: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/spinner", () => ({
  Spinner: () => <span data-testid="spinner" />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-wrapper">{children}</div>
  ),
  TooltipTrigger: ({ render }: { render: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{render}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

vi.mock("lucide-react", () => {
  const icon = ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <svg {...props}>{children}</svg>
  );
  return {
    Box: icon,
    Download: icon,
    Trash2: icon,
    Pencil: icon,
    Copy: icon,
    Move: icon,
    Star: icon,
    BookOpen: icon,
    Type: icon,
    Share2: icon,
  };
});

const makeItem = (
  overrides?: Partial<WorkspaceBrowserItem>,
): WorkspaceBrowserItem =>
  ({
    id: "id-1",
    path: "/user/home/data.fasta",
    name: "data.fasta",
    type: "contigs",
    size: 1024,
    creation_time: "2024-01-01",
    owner_id: "user@bvbrc",
    user_permission: "o",
    global_permission: "n",
    ...overrides,
  }) as WorkspaceBrowserItem;

const defaultProps = {
  workspaceGuideUrl: "https://example.com/guide",
  onAction: vi.fn(),
};

describe("WorkspaceActionBar", () => {
  describe("job_result type restrictions", () => {
    it("disables the EDIT TYPE button when a job_result is selected", () => {
      const jobResultItem = makeItem({ type: "job_result" });
      render(
        <WorkspaceActionBar
          {...defaultProps}
          selection={[jobResultItem]}
        />,
      );
      const editTypeButton = screen.getByRole("button", { name: /edit type/i });
      expect(editTypeButton).toBeDisabled();
    });

    it("shows a tooltip on the disabled EDIT TYPE button for job_result", () => {
      const jobResultItem = makeItem({ type: "job_result" });
      render(
        <WorkspaceActionBar
          {...defaultProps}
          selection={[jobResultItem]}
        />,
      );
      const tooltipContent = screen.getAllByTestId("tooltip-content");
      const editTypeTooltip = tooltipContent.find((el) =>
        el.textContent?.includes('Cannot change "job_result" type'),
      );
      expect(editTypeTooltip).toBeDefined();
    });

    it("does not disable the EDIT TYPE button for non-job_result items", () => {
      const regularItem = makeItem({ type: "contigs" });
      render(
        <WorkspaceActionBar
          {...defaultProps}
          selection={[regularItem]}
        />,
      );
      const editTypeButton = screen.getByRole("button", { name: /edit type/i });
      expect(editTypeButton).not.toBeDisabled();
    });

    it("does not call onAction when clicking a disabled EDIT TYPE button", async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const jobResultItem = makeItem({ type: "job_result" });
      render(
        <WorkspaceActionBar
          {...defaultProps}
          onAction={onAction}
          selection={[jobResultItem]}
        />,
      );
      const editTypeButton = screen.getByRole("button", { name: /edit type/i });
      await user.click(editTypeButton);
      expect(onAction).not.toHaveBeenCalledWith(
        "editType",
        expect.anything(),
      );
    });
  });

  describe("protected folder restrictions", () => {
    it("disables the DELETE button when the selection contains the home folder", () => {
      const homeItem = makeItem({
        type: "folder",
        name: "home",
        path: "/alice@bvbrc/home",
      });
      render(<WorkspaceActionBar {...defaultProps} selection={[homeItem]} />);
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it("disables the DELETE button when the selection contains a protected sub-folder", () => {
      const genomeGroups = makeItem({
        type: "folder",
        name: "Genome Groups",
        path: "/alice@bvbrc/home/Genome Groups",
      });
      render(<WorkspaceActionBar {...defaultProps} selection={[genomeGroups]} />);
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it("shows the protected-folder tooltip on the disabled DELETE button", () => {
      const genomeGroups = makeItem({
        type: "folder",
        name: "Genome Groups",
        path: "/alice@bvbrc/home/Genome Groups",
      });
      render(<WorkspaceActionBar {...defaultProps} selection={[genomeGroups]} />);
      const tooltips = screen.getAllByTestId("tooltip-content");
      const protectedTooltip = tooltips.find((el) =>
        el.textContent?.includes("essential"),
      );
      expect(protectedTooltip).toBeDefined();
    });

    it("disables DELETE when a protected folder is in a multi-selection alongside deletable items", () => {
      const protectedItem = makeItem({
        type: "folder",
        name: "Genome Groups",
        path: "/alice@bvbrc/home/Genome Groups",
      });
      const ordinaryItem = makeItem({
        type: "folder",
        name: "My Project",
        path: "/alice@bvbrc/home/My Project",
      });
      render(
        <WorkspaceActionBar
          {...defaultProps}
          selection={[ordinaryItem, protectedItem]}
        />,
      );
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      expect(deleteButton).toBeDisabled();
    });

    it("does not disable DELETE for a non-protected folder inside home", () => {
      const ordinaryItem = makeItem({
        type: "folder",
        name: "My Project",
        path: "/alice@bvbrc/home/My Project",
      });
      render(<WorkspaceActionBar {...defaultProps} selection={[ordinaryItem]} />);
      const deleteButton = screen.getByRole("button", { name: /delete/i });
      expect(deleteButton).not.toBeDisabled();
    });
  });
});
