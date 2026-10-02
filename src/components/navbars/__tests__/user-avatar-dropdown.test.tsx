import { render, screen } from "@testing-library/react";
import type { AuthUser } from "@/lib/auth/types";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    user: null as AuthUser | null,
    isAdmin: false,
    isImpersonating: false,
    originalUsername: null as string | null,
  },
}));

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => mockAuth,
  useAuthActions: () => ({ sendVerificationEmail: vi.fn() }),
  useExitImpersonation: () => vi.fn(),
  useResendVerificationEmail: () => vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuLabel: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  DropdownMenuItem: ({
    children,
    render: renderProp,
    onClick,
  }: {
    children: React.ReactNode;
    render?: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div onClick={onClick}>
      {renderProp}
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// The real submenu is exercised in user-avatar-theme-submenu.test.tsx.
vi.mock("@/components/navbars/theme-menu-options", () => ({
  ThemeMenuOptions: () => <div data-testid="theme-menu-options" />,
}));

vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/auth/signout-button", () => ({
  SignoutButton: () => <button>Sign Out</button>,
}));

vi.mock("@/components/auth/su-login-dialog", () => ({
  SuLoginDialog: () => null,
}));

vi.mock("lucide-react", () => {
  const icon = () => <svg />;
  return {
    NotebookPen: icon,
    BriefcaseBusiness: icon,
    Settings: icon,
    Contrast: icon,
    Mail: icon,
    ShieldUser: icon,
    LogIn: icon,
    LogOut: icon,
  };
});

import { UserAvatarDropdown } from "../user-avatar-dropdown";

function setUser(user: Partial<AuthUser> | null) {
  mockAuth.user = user as AuthUser | null;
  mockAuth.isAdmin = user?.roles?.includes("admin") ?? false;
  mockAuth.isImpersonating = user?.isImpersonating ?? false;
}

describe("UserAvatarDropdown", () => {
  beforeEach(() => {
    setUser(null);
  });

  describe("greeting label", () => {
    it("shows the username when user is authenticated", () => {
      setUser({ id: "alice", username: "alice", email: "alice@example.com" });
      render(<UserAvatarDropdown />);
      expect(screen.getByText("alice")).toBeInTheDocument();
    });

    it("falls back to 'User' when user is null", () => {
      setUser(null);
      render(<UserAvatarDropdown />);
      expect(screen.getByText("User")).toBeInTheDocument();
    });

    it("does not render an empty greeting when username is absent", () => {
      setUser(null);
      const { container } = render(<UserAvatarDropdown />);
      const labels = container.querySelectorAll("span");
      const greetingSpan = Array.from(labels).find(
        (el) => el.textContent === "User",
      );
      expect(greetingSpan).toBeDefined();
      expect(greetingSpan?.textContent).not.toBe("");
    });
  });

  describe("avatar fallback letter", () => {
    it("shows the first letter of the username uppercased", () => {
      setUser({ id: "bob", username: "bob", email: "bob@example.com" });
      render(<UserAvatarDropdown />);
      expect(screen.getByText("B")).toBeInTheDocument();
    });

    it("falls back to 'U' when user is null", () => {
      setUser(null);
      render(<UserAvatarDropdown />);
      expect(screen.getByText("U")).toBeInTheDocument();
    });
  });
});
