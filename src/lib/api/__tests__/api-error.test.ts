import { ApiError } from "../api-error";

describe("ApiError", () => {
  it("stores status and string body", () => {
    const err = new ApiError(400, "Bad request");
    expect(err.status).toBe(400);
    expect(err.body).toBe("Bad request");
    expect(err.message).toBe("Bad request");
    expect(err.name).toBe("ApiError");
  });

  it("stores status and object body", () => {
    const body = { error: "Validation failed", fields: ["name"] };
    const err = new ApiError(422, body);
    expect(err.status).toBe(422);
    expect(err.body).toEqual(body);
    expect(err.message).toBe(JSON.stringify(body));
  });

  it("is an instance of Error", () => {
    const err = new ApiError(500, "oops");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
  });
});
