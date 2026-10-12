import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { useAuthActions } from "@/lib/auth/provider";
import type { UserProfile } from "@/lib/auth/types";
import {
  findOption,
  makePickerRepository,
  pickerHome as home,
  pickerRepositoryWrapper,
  pickerUser,
  selectButton,
  stubPickerBrowserApis,
} from "@/components/workspace/folder-picker/__tests__/fixtures/picker-harness";

vi.mock("@/lib/auth/provider", () => ({
  useAuth: () => ({ user: pickerUser }),
  useAuthActions: vi.fn(() => ({
    updateProfile: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

stubPickerBrowserApis();

const profile: UserProfile = {
  id: "alice",
  l_id: "alice",
  email: "alice@example.org",
  email_verified: true,
  first_name: "Alice",
  last_name: "Example",
  organisms: "",
  creation_date: "2026-01-01T00:00:00Z",
  last_login: "2026-10-01T00:00:00Z",
  reverification: false,
  source: "bvbrc",
  settings: {},
};

it("saves a default folder chosen in the picker", async () => {
  const updateProfile = vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAuthActions).mockReturnValue({
    updateProfile,
  } as unknown as ReturnType<typeof useAuthActions>);
  render(<PreferencesForm profile={profile} />, {
    wrapper: pickerRepositoryWrapper(makePickerRepository()),
  });
  const user = userEvent.setup();
  await user.click(
    screen.getByRole("button", { name: "Browse workspace folders" }),
  );
  expect(
    await screen.findByRole("dialog", {
      name: "Select a Default Output Folder",
    }),
  ).toBeInTheDocument();
  await user.dblClick(await findOption("Home", "Experiments"));
  await user.click(screen.getByRole("button", { name: "Save Preferences" }));
  expect(updateProfile).toHaveBeenCalledWith([
    {
      op: "replace",
      path: "/settings",
      value: { default_job_folder: `${home}/Experiments` },
    },
  ]);
});

it("refuses hidden folders as the default", async () => {
  render(
    <PreferencesForm
      profile={{
        ...profile,
        settings: { default_job_folder: `${home}/.hidden` },
      }}
    />,
    { wrapper: pickerRepositoryWrapper(makePickerRepository()) },
  );
  await userEvent
    .setup()
    .click(screen.getByRole("button", { name: "Browse workspace folders" }));
  await screen.findByRole("dialog", { name: "Select a Default Output Folder" });
  // Select is also disabled while the Home column loads, so the filter's
  // reason has to show before the disabled state means anything.
  expect(
    await screen.findByText("This folder can't be used here."),
  ).toBeInTheDocument();
  expect(selectButton()).toBeDisabled();
});
