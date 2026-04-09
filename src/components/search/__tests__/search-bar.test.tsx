import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { mockPush, mockSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockSearchParams: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams.current,
}));

import { SearchBar } from "../search-bar";

function renderSearchBar(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

  const result = render(
    <QueryClientProvider client={queryClient}>
      <SearchBar {...props} />
    </QueryClientProvider>,
  );

  return { ...result, queryClient, invalidateSpy };
}

function getForm(): HTMLFormElement {
  const input = screen.getByRole("textbox");
  const form = input.closest("form");
  if (!form) throw new Error("Expected input to be inside a <form>");
  return form;
}

describe("SearchBar", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams.current = new URLSearchParams();
  });

  describe("rendering", () => {
    it("renders with default placeholder", () => {
      renderSearchBar();
      expect(
        screen.getByPlaceholderText(/Search by virus name/),
      ).toBeInTheDocument();
    });

    it("renders with custom placeholder", () => {
      renderSearchBar({ placeholder: "Custom search" });
      expect(screen.getByPlaceholderText("Custom search")).toBeInTheDocument();
    });

    it("applies className to the form", () => {
      renderSearchBar({ className: "max-w-[1000px]" });
      const form = getForm();
      expect(form.className).toContain("max-w-[1000px]");
    });
  });

  describe("form submission", () => {
    it("does not navigate when input is empty", () => {
      renderSearchBar();
      fireEvent.submit(getForm());
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("does not navigate when input is only whitespace", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.type(screen.getByRole("textbox"), "   ");
      fireEvent.submit(getForm());

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("navigates to /search with query and default searchtype", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.type(screen.getByRole("textbox"), "SARS-CoV-2");
      fireEvent.submit(getForm());

      expect(mockPush).toHaveBeenCalledWith(
        "/search?q=SARS-CoV-2&searchtype=everything",
      );
    });

    it("URL-encodes special characters in the query", async () => {
      const user = userEvent.setup();
      renderSearchBar();

      await user.type(screen.getByRole("textbox"), "test & more");
      fireEvent.submit(getForm());

      expect(mockPush).toHaveBeenCalledWith(
        "/search?q=test%20%26%20more&searchtype=everything",
      );
    });

    it("invalidates genome query cache on submit", async () => {
      const user = userEvent.setup();
      const { invalidateSpy } = renderSearchBar();

      await user.type(screen.getByRole("textbox"), "test");
      fireEvent.submit(getForm());

      expect(invalidateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("SearchParamsSync", () => {
    it("syncs single keyword query from URL params into input", async () => {
      mockSearchParams.current = new URLSearchParams();
      mockSearchParams.current.set("q", "keyword(SARS)");

      renderSearchBar();

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toHaveValue("SARS");
      });
    });

    it("joins multiple keyword matches from URL params", async () => {
      mockSearchParams.current = new URLSearchParams();
      mockSearchParams.current.set("q", "keyword(SARS) keyword(CoV)");

      renderSearchBar();

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toHaveValue("SARS CoV");
      });
    });

    it("preserves plain text when q param has no keyword pattern", async () => {
      mockSearchParams.current = new URLSearchParams();
      mockSearchParams.current.set("q", "plain text");

      renderSearchBar();

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toHaveValue("plain text");
      });
    });

    it("sets empty string when no q param exists", async () => {
      mockSearchParams.current = new URLSearchParams();

      renderSearchBar();

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toHaveValue("");
      });
    });
  });
});
