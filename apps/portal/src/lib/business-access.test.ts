import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  businessAccountEmail,
  readBusinessLoginForm,
  readDisableBusinessAccessForm,
  readSetBusinessAccessForm,
} from "./business-access";

const dealerId = "11111111-1111-4111-8111-111111111111";
const partyId = "22222222-2222-4222-8222-222222222222";

describe("business portal access", () => {
  it("uses a deterministic internal identity without asking the business for email", () => {
    expect(businessAccountEmail(partyId)).toBe(
      "business-22222222222242228222222222222222@accounts.eec.invalid",
    );
  });

  it("accepts a license number and private access code", () => {
    const form = new FormData();
    form.set("license_reference", "LIC-1001-ABCDE12345");
    form.set("access_code", "private-code-2026");
    expect(readBusinessLoginForm(form).success).toBe(true);
  });

  it("rejects short access codes", () => {
    const form = new FormData();
    form.set("dealer_authorization_id", dealerId);
    form.set("access_code", "short");
    expect(readSetBusinessAccessForm(form).success).toBe(false);
  });

  it("accepts a valid disable command", () => {
    const form = new FormData();
    form.set("dealer_authorization_id", dealerId);
    expect(readDisableBusinessAccessForm(form).success).toBe(true);
  });

  it("keeps email and Discord fields off the business sign-in screen", () => {
    const source = readFileSync(
      new URL("../app/dealer/login/page.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain('name="license_reference"');
    expect(source).toContain('name="access_code"');
    expect(source).not.toContain('name="email"');
    expect(source).not.toContain("Representative email");
  });
});
