import { describe, expect, it } from "vitest";

import { readRequestId } from "@/lib/request-id";

describe("command request ids", () => {
  it("accepts a UUID generated with the form", () => {
    const form = new FormData();
    form.set("request_id", "91000000-0000-4000-8000-000000000001");
    expect(readRequestId(form)).toBe("91000000-0000-4000-8000-000000000001");
  });

  it("rejects a missing or malformed request id", () => {
    expect(readRequestId(new FormData())).toBeNull();
    const form = new FormData();
    form.set("request_id", "not-a-request-id");
    expect(readRequestId(form)).toBeNull();
  });
});
