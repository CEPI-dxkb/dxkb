import { renderHook, act } from "@testing-library/react";
import { useFastaValidation } from "@/hooks/use-fasta-validation";

const validDnaFasta = ">seq1\nATCGATCGATCG";
const invalidFasta = "not a fasta at all";

describe("useFastaValidation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("has correct initial state", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn" }),
    );

    expect(result.current.fastaText).toBe("");
    expect(result.current.validationResult).toBeNull();
    expect(result.current.isValid).toBe(false);
    expect(result.current.isValidating).toBe(false);
    expect(result.current.errorMessage).toBe("");
  });

  it("updates fastaText immediately and sets isValidating to true on setFastaText", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn" }),
    );

    act(() => {
      result.current.setFastaText(validDnaFasta);
    });

    expect(result.current.fastaText).toBe(validDnaFasta);
    expect(result.current.isValidating).toBe(true);
    // Validation result should not be set yet (debounce hasn't fired)
    expect(result.current.validationResult).toBeNull();
  });

  it("sets validationResult and clears isValidating after debounce fires", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn", debounceMs: 300 }),
    );

    act(() => {
      result.current.setFastaText(validDnaFasta);
    });

    expect(result.current.isValidating).toBe(true);
    expect(result.current.validationResult).toBeNull();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.isValidating).toBe(false);
    expect(result.current.validationResult).not.toBeNull();
  });

  it("validateFasta validates immediately without debounce when fastaText is non-empty", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn" }),
    );

    // First set some text and let debounce fire so fastaText is populated
    act(() => {
      result.current.setFastaText(validDnaFasta);
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Reset by checking current state
    const previousResult = result.current.validationResult;
    expect(previousResult).not.toBeNull();

    // Call validateFasta directly - it should validate immediately
    act(() => {
      result.current.validateFasta();
    });

    expect(result.current.isValidating).toBe(false);
    expect(result.current.validationResult).not.toBeNull();
  });

  it("validateFasta does nothing when fastaText is empty", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn" }),
    );

    act(() => {
      result.current.validateFasta();
    });

    expect(result.current.validationResult).toBeNull();
    expect(result.current.isValidating).toBe(false);
  });

  it("returns isValid true and empty errorMessage for valid DNA FASTA with blastn", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn", debounceMs: 100 }),
    );

    act(() => {
      result.current.setFastaText(validDnaFasta);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.errorMessage).toBe("");
    expect(result.current.validationResult?.status).toBe("valid_dna");
  });

  it("returns isValid false and sets errorMessage for invalid FASTA", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn", debounceMs: 100 }),
    );

    act(() => {
      result.current.setFastaText(invalidFasta);
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.errorMessage).not.toBe("");
  });

  it("debounces multiple rapid calls and only validates the last value", () => {
    const { result } = renderHook(() =>
      useFastaValidation({ inputType: "blastn", debounceMs: 300 }),
    );

    act(() => {
      result.current.setFastaText(">seq1\nA");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setFastaText(validDnaFasta);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.fastaText).toBe(validDnaFasta);
    expect(result.current.isValid).toBe(true);
    expect(result.current.isValidating).toBe(false);
  });
});
