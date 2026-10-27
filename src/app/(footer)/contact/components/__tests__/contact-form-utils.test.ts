import { contactRequestError } from "../contact-form-utils";

describe("contactRequestError", () => {
  it("names every fetch TypeError as a network failure, Safari's included", () => {
    expect(contactRequestError(new TypeError("Load failed"))).toBe(
      "Could not reach the contact service: Load failed.",
    );
  });

  it("keeps any other error's own message", () => {
    expect(contactRequestError(new Error("Unexpected end of JSON input"))).toBe(
      "Unexpected end of JSON input",
    );
  });
});
