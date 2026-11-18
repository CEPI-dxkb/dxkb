import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/auth/provider", () => ({
  useAuthActions: () => ({ startImpersonation: vi.fn() }),
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { SuLoginDialog } from "../su-login-dialog";

describe("SuLoginDialog", () => {
  it("shows and hides the admin password with a toggle", () => {
    render(<SuLoginDialog open onOpenChange={vi.fn()} />);
    const password = screen.getByLabelText("Your Password");
    expect(password).toHaveAttribute("type", "password");

    fireEvent.change(password, { target: { value: "s3cret" } });
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));

    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("s3cret");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));

    expect(password).toHaveAttribute("type", "password");
  });

  it("keeps the field's placeholder and autocomplete", () => {
    render(<SuLoginDialog open onOpenChange={vi.fn()} />);
    const password = screen.getByLabelText("Your Password");
    expect(password).toHaveAttribute("placeholder", "Your admin password");
    expect(password).toHaveAttribute("autocomplete", "off");
  });
});
