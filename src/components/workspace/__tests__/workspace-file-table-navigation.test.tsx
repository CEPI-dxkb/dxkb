import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";
import { createPendingNavigation } from "@/test-helpers/pending-navigation";
import { WorkspaceDataTable } from "@/components/workspace/workspace-file-table";
import { workspaceParentDestination } from "@/lib/services/workspace/path-utils";
import type { WorkspaceItem } from "@/lib/services/workspace/domain";

const pushSpy = vi.fn();
const pendingNavigation = createPendingNavigation();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
  usePathname: () => "/workspace/alice@bvbrc/home",
  useSearchParams: () => new URLSearchParams(),
}));

class ResizeObserverStub {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const folder: WorkspaceItem = {
  id: "reads",
  name: "reads",
  path: "/alice@bvbrc/home/reads",
  type: "folder",
  size: 0,
};

function renderTable() {
  return render(
    <>
      <WorkspaceDataTable
        items={[folder]}
        isLoading={false}
        path="/alice@bvbrc/home"
        username="alice"
        sort={{ field: "name", direction: "asc" }}
        onSortChange={vi.fn()}
      />
      <Suspense fallback={null}>
        <pendingNavigation.Suspender />
      </Suspense>
    </>,
  );
}

beforeEach(() => {
  pushSpy.mockReset();
});

it("pushes the parent folder destination from the parent row", () => {
  renderTable();
  fireEvent.click(screen.getByText("Parent folder"));
  expect(pushSpy).toHaveBeenCalledTimes(1);
  expect(pushSpy).toHaveBeenCalledWith(
    workspaceParentDestination({
      mode: "home",
      path: "/alice@bvbrc/home",
      username: "alice",
    }),
  );
});

it("marks the table busy while a folder navigation is pending", () => {
  pushSpy.mockImplementationOnce(() => {
    pendingNavigation.arm();
  });
  renderTable();
  const busyRegion = () => document.querySelector("[aria-busy]");
  expect(busyRegion()).toBeNull();

  act(() => {
    fireEvent.click(screen.getByText("Parent folder"));
  });

  expect(pushSpy).toHaveBeenCalledTimes(1);
  expect(busyRegion()).toHaveAttribute("aria-busy", "true");
  expect(busyRegion()).toHaveAttribute("data-pending");
  expect(busyRegion()).toContainElement(screen.getByRole("table"));
});

it("marks the table busy while a folder opened in selection mode is pending", () => {
  const openFolder = vi.fn(() => {
    pendingNavigation.arm();
  });
  render(
    <>
      <WorkspaceDataTable
        items={[folder]}
        isLoading={false}
        path="/alice@bvbrc/home"
        username="alice"
        sort={{ field: "name", direction: "asc" }}
        onSortChange={vi.fn()}
        onSelect={vi.fn()}
        onItemDoubleClick={openFolder}
      />
      <Suspense fallback={null}>
        <pendingNavigation.Suspender />
      </Suspense>
    </>,
  );
  expect(document.querySelector("[aria-busy]")).toBeNull();

  act(() => {
    fireEvent.doubleClick(screen.getByText("reads"));
  });

  expect(openFolder).toHaveBeenCalledWith(folder);
  const busy = document.querySelector("[aria-busy]");
  expect(busy).toHaveAttribute("aria-busy", "true");
  expect(busy).toHaveAttribute("data-pending");
});
