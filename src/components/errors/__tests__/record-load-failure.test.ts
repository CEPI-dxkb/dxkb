import { UpstreamError } from "@/lib/api/upstream-failure";
import { DataApiError } from "@/lib/data-api/repository";
import { connectTimeout, connectionRefused } from "@/test-helpers/upstream-failures";

import {
  recordUnavailableFallback,
  recordUnavailableMessage,
  upstreamOutageMessage,
} from "../record-load-failure";

describe("recordUnavailableMessage", () => {
  it("keeps a data-service outage's own message", () => {
    expect(
      recordUnavailableMessage(
        new DataApiError(
          "The data service is temporarily unavailable. Please try again.",
          503,
          "service_unavailable",
        ),
      ),
    ).toBe("The data service is temporarily unavailable. Please try again.");
    expect(
      recordUnavailableMessage(new DataApiError("Bad gateway", 502)),
    ).toBe("Bad gateway");
  });

  it.each([401, 403, 404, 409, 429, 499])(
    "leaves a %s to the loader's own handling",
    (status) => {
      expect(recordUnavailableMessage(new DataApiError("no", status))).toBeNull();
    },
  );

  it("never renders a configuration error, whose message names an env var", () => {
    expect(
      recordUnavailableMessage(
        new DataApiError("DATA_API_URL is not configured.", 500, "not_configured"),
      ),
    ).toBeNull();
    expect(
      recordUnavailableMessage(
        new DataApiError(
          "Authenticated data service requests require HTTPS.",
          500,
          "insecure_upstream",
        ),
      ),
    ).toBeNull();
  });

  it("describes a raw network failure instead of printing 'fetch failed'", () => {
    expect(recordUnavailableMessage(connectTimeout())).toBe(
      "The BV-BRC data service did not respond (connection timed out after 10 s).",
    );
    expect(recordUnavailableMessage(connectionRefused())).toBe(
      "Could not reach the BV-BRC data service: connection refused.",
    );
  });

  it("keeps an UpstreamError's message", () => {
    expect(
      recordUnavailableMessage(
        new UpstreamError({
          status: 504,
          code: "upstream_timeout",
          message: "The BV-BRC data service did not respond (timed out after 20 s).",
        }),
      ),
    ).toBe("The BV-BRC data service did not respond (timed out after 20 s).");
  });

  it("leaves an ordinary error (a bug) to the error boundary", () => {
    expect(recordUnavailableMessage(new Error("Backend unavailable"))).toBeNull();
    expect(recordUnavailableMessage(new TypeError("x is undefined"))).toBeNull();
    expect(recordUnavailableMessage("boom")).toBeNull();
  });

  it("condenses a long message and falls back when there is none", () => {
    const long = recordUnavailableMessage(new DataApiError("x".repeat(1000), 502));
    expect(long?.length).toBeLessThan(1000);
    expect(long?.endsWith("…")).toBe(true);
    expect(recordUnavailableMessage(new DataApiError("", 503))).toBe(
      recordUnavailableFallback,
    );
  });
});

describe("upstreamOutageMessage", () => {
  const service = "the BV-BRC taxonomy service";
  const options = { fallback: "fallback" };

  it("describes a raw network failure, naming the service", () => {
    expect(upstreamOutageMessage(connectionRefused(), service, options)).toBe(
      "Could not reach the BV-BRC taxonomy service: connection refused.",
    );
  });

  it("keeps a 5xx UpstreamError's own message", () => {
    expect(
      upstreamOutageMessage(
        new UpstreamError({
          status: 503,
          code: "service_unavailable",
          message: "503 Service Unavailable: Site Maintenance",
        }),
        service,
        options,
      ),
    ).toBe("503 Service Unavailable: Site Maintenance");
  });

  it("is null for anything that is not an outage, so the caller rethrows it", () => {
    expect(
      upstreamOutageMessage(
        new Error("Missing required environment variable: BVBRC_WEBSITE_API_URL"),
        service,
        options,
      ),
    ).toBeNull();
    expect(
      upstreamOutageMessage(new Error("taxonomy/2: malformed JSON response"), service, options),
    ).toBeNull();
    expect(
      upstreamOutageMessage(
        new UpstreamError({ status: 400, code: "upstream_error", message: "bad" }),
        service,
        options,
      ),
    ).toBeNull();
    expect(upstreamOutageMessage(null, service, options)).toBeNull();
  });
});
