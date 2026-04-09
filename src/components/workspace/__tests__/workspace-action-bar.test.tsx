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
});
