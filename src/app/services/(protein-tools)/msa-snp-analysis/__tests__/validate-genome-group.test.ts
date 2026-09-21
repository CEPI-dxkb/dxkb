import {
  fetchGenomeGroupMembers,
  validateViralGenomes,
} from "@/lib/services/genome";
import { validateGenomeGroup } from "../validate-genome-group";

vi.mock("@/lib/services/genome", () => ({
  fetchGenomeGroupMembers: vi.fn(),
  validateViralGenomes: vi.fn(),
}));

const fetchMembersMock = vi.mocked(fetchGenomeGroupMembers);
const validateViralGenomesMock = vi.mocked(validateViralGenomes);
const options = { maxGenomes: 2, maxGenomeLength: 250000 };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("validateGenomeGroup", () => {
  it("rejects empty and oversized groups before viral validation", async () => {
    fetchMembersMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { genome_id: "1" },
      { genome_id: "2" },
      { genome_id: "3" },
    ] as never);

    await expect(validateGenomeGroup("/empty", options)).resolves.toEqual({
      status: "empty",
    });
    await expect(validateGenomeGroup("/large", options)).resolves.toEqual({
      status: "too-large",
      genomeCount: 3,
    });
    expect(validateViralGenomesMock).not.toHaveBeenCalled();
  });

  it("preserves viral validation errors", async () => {
    fetchMembersMock.mockResolvedValue([{ genome_id: "1" }] as never);
    validateViralGenomesMock.mockResolvedValue({
      allValid: false,
      errors: { "1": "Genome 1 is not viral" },
    } as never);

    await expect(validateGenomeGroup("/invalid", options)).resolves.toEqual({
      status: "invalid",
      message: "Genome 1 is not viral",
    });
  });

  it("returns the validated genome count", async () => {
    fetchMembersMock.mockResolvedValue([
      { genome_id: "1" },
      { genome_id: "2" },
    ] as never);
    validateViralGenomesMock.mockResolvedValue({
      allValid: true,
      errors: {},
    } as never);

    await expect(validateGenomeGroup("/valid", options)).resolves.toEqual({
      status: "valid",
      genomeCount: 2,
    });
    expect(validateViralGenomesMock).toHaveBeenCalledWith(["1", "2"], {
      maxGenomeLength: 250000,
    });
  });
});
