vi.mock("@/hooks/use-authenticated-fetch-client", () => ({
  useAuthenticatedFetch: vi.fn(() => (url: string) => fetch(url)),
}));

import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test-helpers/msw-server";
import { createQueryClientWrapper } from "@/test-helpers/api-route-helpers";
import { useDefaultOutputPath } from "../use-default-output-path";
import type { UserProfile } from "@/lib/auth/types";

function makeForm(currentValue = "") {
  return {
    getFieldValue: vi.fn((_field: "output_path") => currentValue),
    setFieldValue: vi.fn(),
  };
}

function profileWith(defaultJobFolder?: string): Partial<UserProfile> {
  return {
    id: "testuser",
    email: "test@example.com",
    first_name: "Test",
    last_name: "User",
    email_verified: true,
    creation_date: "2024-01-01",
    l_id: "123",
    last_login: "2024-01-01",
    organisms: "",
    reverification: false,
    source: "bvbrc",
    ...(defaultJobFolder !== undefined && {
      settings: { default_job_folder: defaultJobFolder },
    }),
  };
}

function serveProfile(profile: Partial<UserProfile>) {
  const fetched = vi.fn();
  server.use(
    http.get("*/api/auth/profile", () => {
      fetched();
      return HttpResponse.json(profile);
    }),
  );
  return { fetched };
}

describe("useDefaultOutputPath", () => {
  it("sets output_path when profile has default_job_folder and field is empty", async () => {
    const profile = profileWith("/testuser@bvbrc/my-jobs/");
    serveProfile(profile);
    const form = makeForm("");
    const wrapper = createQueryClientWrapper();

    renderHook(() => useDefaultOutputPath(form, null), { wrapper });

    await waitFor(() => {
      expect(form.setFieldValue).toHaveBeenCalledWith(
        "output_path",
        "/testuser@bvbrc/my-jobs/",
      );
    });
  });

  it("skips when rerunData is present", async () => {
    const profile = profileWith("/testuser@bvbrc/my-jobs/");
    const { fetched } = serveProfile(profile);
    const form = makeForm("");
    const wrapper = createQueryClientWrapper();

    renderHook(() => useDefaultOutputPath(form, { output_path: "/rerun-path/" }), {
      wrapper,
    });

    await waitFor(() => {
      expect(fetched).toHaveBeenCalled();
    });
    expect(form.setFieldValue).not.toHaveBeenCalled();
  });

  it("skips when output_path already has a value", async () => {
    const profile = profileWith("/testuser@bvbrc/my-jobs/");
    const { fetched } = serveProfile(profile);
    const form = makeForm("/already-set/");
    const wrapper = createQueryClientWrapper();

    renderHook(() => useDefaultOutputPath(form, null), { wrapper });

    await waitFor(() => {
      expect(fetched).toHaveBeenCalled();
    });
    expect(form.setFieldValue).not.toHaveBeenCalled();
  });

  it("skips when profile has no default_job_folder setting", async () => {
    const profile = profileWith();
    const { fetched } = serveProfile(profile);
    const form = makeForm("");
    const wrapper = createQueryClientWrapper();

    renderHook(() => useDefaultOutputPath(form, null), { wrapper });

    await waitFor(() => {
      expect(fetched).toHaveBeenCalled();
    });
    expect(form.setFieldValue).not.toHaveBeenCalled();
  });

  it("only applies once even if the effect re-runs", async () => {
    const profile = profileWith("/testuser@bvbrc/my-jobs/");
    serveProfile(profile);
    const form = makeForm("");
    const wrapper = createQueryClientWrapper();

    const { rerender } = renderHook(() => useDefaultOutputPath(form, null), {
      wrapper,
    });

    await waitFor(() => {
      expect(form.setFieldValue).toHaveBeenCalledTimes(1);
    });

    rerender();

    expect(form.setFieldValue).toHaveBeenCalledTimes(1);
  });
});
