import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import React from "react";

import { useRerunForm } from "@/hooks/services/use-rerun-form";
import { AuthBoundary } from "@/lib/auth/provider";
import type { AuthUser } from "@/lib/auth/types";
import { server } from "@/test-helpers/msw-server";
import type { Library } from "@/types/services";

function makeForm() {
  const values: Record<string, unknown> = {};
  return {
    getFieldValue: vi.fn((field: string) => values[field]),
    setFieldValue: vi.fn((field: string, value: unknown) => {
      values[field] = value;
    }),
    _values: values,
  };
}

function makeWrapper(user: AuthUser | null = null) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <AuthBoundary user={user}>{children}</AuthBoundary>;
  };
}

const wrapper = makeWrapper();

function userWithFolder(defaultJobFolder?: string): AuthUser {
  return {
    id: "u",
    username: "u",
    email: "u@example.com",
    ...(defaultJobFolder ? { defaultJobFolder } : {}),
  };
}

function setRerunSession(key: string, payload: Record<string, unknown>) {
  sessionStorage.setItem(key, JSON.stringify(payload));
  window.history.replaceState({}, "", `/?rerun_key=${key}`);
}

function clearUrl() {
  window.history.replaceState({}, "", "/");
}

beforeEach(() => {
  sessionStorage.clear();
  clearUrl();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRerunForm", () => {
  it("returns null rerunData when no ?rerun_key= is present", () => {
    const form = makeForm();
    const { result } = renderHook(
      () => useRerunForm({ form, defaultOutputPath: null }),
      {
        wrapper,
      },
    );
    expect(result.current.rerunData).toBeNull();
  });

  it("reads sessionStorage entry on mount and leaves it in place across remounts", () => {
    setRerunSession("k1", { foo: "bar" });
    const form = makeForm();
    const { result } = renderHook(
      () => useRerunForm({ form, defaultOutputPath: null }),
      {
        wrapper,
      },
    );
    expect(result.current.rerunData).toEqual({ foo: "bar" });
    expect(sessionStorage.getItem("k1")).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("returns null when stored JSON is malformed (no throw)", () => {
    sessionStorage.setItem("k2", "{not json");
    window.history.replaceState({}, "", "/?rerun_key=k2");
    const form = makeForm();
    const { result } = renderHook(
      () => useRerunForm({ form, defaultOutputPath: null }),
      {
        wrapper,
      },
    );
    expect(result.current.rerunData).toBeNull();
  });

  it("auto-applies declared fields via setFieldValue", async () => {
    setRerunSession("k3", { output_path: "/ws/out", recipe: "spades" });
    const form = makeForm();
    renderHook(
      () =>
        useRerunForm({
          form,
          fields: ["output_path", "recipe"],
          defaultOutputPath: null,
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(form.setFieldValue).toHaveBeenCalledWith("output_path", "/ws/out");
      expect(form.setFieldValue).toHaveBeenCalledWith("recipe", "spades");
    });
  });

  it("builds libraries for declared kinds and calls syncLibraries", async () => {
    setRerunSession("k4", {
      paired_end_libs: [{ read1: "/r1.fq", read2: "/r2.fq" }],
      single_end_libs: [{ read: "/s.fq" }],
      srr_libs: [{ srr_accession: "SRR1" }],
    });
    const form = makeForm();
    const syncLibraries = vi.fn();
    renderHook(
      () =>
        useRerunForm({
          form,
          libraries: ["paired", "single", "sra"],
          syncLibraries,
          defaultOutputPath: null,
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(syncLibraries).toHaveBeenCalledTimes(1);
    });
    const libs = syncLibraries.mock.calls[0][0] as Library[];
    expect(libs.map((l) => l.type)).toEqual(["paired", "single", "sra"]);
  });

  it("warns when libraries are declared without syncLibraries", async () => {
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    setRerunSession("k4-warning", {
      single_end_libs: [{ read: "/s.fq" }],
    });
    const form = makeForm();

    renderHook(
      () =>
        useRerunForm({
          form,
          libraries: ["single"],
          defaultOutputPath: null,
        } as never),
      { wrapper },
    );

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        "[useRerunForm] libraries were configured but syncLibraries is missing; built libraries were not applied.",
      );
    });
    warnSpy.mockRestore();
  });

  it("invokes getLibraryExtra with the correct kind per library", async () => {
    setRerunSession("k5", {
      paired_end_libs: [
        { read1: "/r1.fq", read2: "/r2.fq", platform: "illumina" },
      ],
      single_end_libs: [{ read: "/s.fq", platform: "nanopore" }],
      srr_libs: [{ srr_accession: "SRR1" }],
    });
    const form = makeForm();
    const seenKinds: string[] = [];
    renderHook(
      () =>
        useRerunForm({
          form,
          libraries: ["paired", "single", "sra"],
          getLibraryExtra: (_lib, kind) => {
            seenKinds.push(kind);
            return {};
          },
          syncLibraries: vi.fn(),
          defaultOutputPath: null,
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(seenKinds).toEqual(["paired", "single", "sra"]);
    });
  });

  it("invokes onApply once AFTER auto-apply with the built libraries", async () => {
    setRerunSession("k6", {
      output_path: "/ws/out",
      paired_end_libs: [{ read1: "/r1.fq", read2: "/r2.fq" }],
    });
    const form = makeForm();
    const onApply = vi.fn();
    renderHook(
      () =>
        useRerunForm({
          form,
          fields: ["output_path"],
          libraries: ["paired"],
          syncLibraries: vi.fn(),
          onApply,
          defaultOutputPath: null,
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(onApply).toHaveBeenCalledTimes(1);
    });
    const [rerunDataArg, formArg, libsArg] = onApply.mock.calls[0] as [unknown, unknown, unknown[]];
    expect(rerunDataArg).toMatchObject({ output_path: "/ws/out" });
    expect(formArg).toBe(form);
    expect(libsArg).toHaveLength(1);
  });

  it("does not re-apply on re-render (one-shot guard)", async () => {
    setRerunSession("k7", { output_path: "/ws/out" });
    const form = makeForm();
    const { rerender } = renderHook(
      () =>
        useRerunForm({
          form,
          fields: ["output_path"],
          defaultOutputPath: null,
        }),
      { wrapper },
    );
    await waitFor(() => {
      expect(form.setFieldValue).toHaveBeenCalledTimes(1);
    });
    rerender();
    rerender();
    expect(form.setFieldValue).toHaveBeenCalledTimes(1);
  });

  it("applies defaultJobFolder from the signed-in user without a profile request", async () => {
    let profileRequests = 0;
    server.use(
      http.get("*/api/auth/profile", () => {
        profileRequests += 1;
        return HttpResponse.json({});
      }),
    );
    const form = makeForm();
    renderHook(() => useRerunForm({ form }), {
      wrapper: makeWrapper(userWithFolder("/ws/user/default")),
    });
    await waitFor(() => {
      expect(form.setFieldValue).toHaveBeenCalledWith(
        "output_path",
        "/ws/user/default",
      );
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(profileRequests).toBe(0);
  });

  it("applies nothing when the user has no defaultJobFolder", async () => {
    const form = makeForm();
    renderHook(() => useRerunForm({ form }), {
      wrapper: makeWrapper(userWithFolder()),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(form.setFieldValue).not.toHaveBeenCalled();
  });

  it("skips default folder application when rerun data is present", async () => {
    setRerunSession("k8", { output_path: "/ws/rerun" });
    const form = makeForm();
    renderHook(() => useRerunForm({ form, fields: ["output_path"] }), {
      wrapper: makeWrapper(userWithFolder("/ws/default")),
    });
    await waitFor(() => {
      expect(form.setFieldValue).toHaveBeenCalledWith(
        "output_path",
        "/ws/rerun",
      );
    });
    expect(form.setFieldValue).not.toHaveBeenCalledWith(
      "output_path",
      "/ws/default",
    );
  });

  it("opts out of default-output-path when defaultOutputPath is null", async () => {
    const form = makeForm();
    renderHook(() => useRerunForm({ form, defaultOutputPath: null }), {
      wrapper: makeWrapper(userWithFolder("/ws/default")),
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(form.setFieldValue).not.toHaveBeenCalled();
  });
});
