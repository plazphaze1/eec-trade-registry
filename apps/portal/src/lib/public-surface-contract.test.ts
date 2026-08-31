import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("public rendering contracts", () => {
  it("ships a useful catalogue h1 in the server-rendered route source", () => {
    const catalogue = source("../app/page.tsx");
    expect(catalogue).toContain("<h1>Find what you need.</h1>");
    expect(catalogue).not.toContain("Retrieving current catalogue records");
  });

  it("ships the authoritative item name and description metadata on detail pages", () => {
    const detail = source("../app/catalogue/[slug]/page.tsx");
    expect(detail).toContain("<h1>{item.display_name}</h1>");
    expect(detail).toContain("description: result.data.description");
  });

  it("keeps routine item pages simple while retaining real restrictions", () => {
    const detail = source("../app/catalogue/[slug]/page.tsx");
    expect(detail).not.toContain("{item.category_name} · {item.item_code}");
    expect(detail).toContain('item.control_code !== "ordinary-economic"');
    expect(detail).toContain("Business sign in");
    expect(detail).toContain("Get a trade license");
  });

  it("uses player-facing business language across public verification", () => {
    const routes = [
      source("../app/layout.tsx"),
      source("../app/verify/page.tsx"),
      source("../app/verify/opengraph-image.tsx"),
      source("../app/opengraph-image.tsx"),
      source("../components/verification-form.tsx"),
      source("../components/verification-result.tsx"),
    ].join("\n");

    expect(routes).not.toMatch(
      /dealer authorizations|dealer verification|Public dealer record|Dealer type|This dealer authorization/i,
    );
    expect(routes).toContain("Verify a business or license");
    expect(routes).toContain("Public business record");
  });

  it("keeps missing and withdrawn pages useful instead of exposing protocol details", () => {
    const missing = source("../app/not-found.tsx");
    const withdrawn = source("../app/catalogue/withdrawn/page.tsx");
    expect(missing).toContain("Page not found.");
    expect(withdrawn).not.toContain("HTTP 410");
    expect(withdrawn).not.toContain("Former catalogue slug");
  });

  it("preserves the old lumber link while making Firewood canonical", () => {
    const redirect = source("../app/catalogue/construction-lumber/page.tsx");
    const migration = source(
      "../../../../supabase/migrations/20260901010000_public_surface_identity_cleanup.sql",
    );
    expect(redirect).toContain('permanentRedirect("/catalogue/firewood")');
    expect(migration).toContain("set slug = 'firewood'");
    expect(migration).toContain("public_name = 'Firewood'");
  });

  it("repairs protected owner names from approved identity data without hard-coding a person", () => {
    const migration = source(
      "../../../../supabase/migrations/20260901010000_public_surface_identity_cleanup.sql",
    );
    expect(migration).toContain(
      "set display_name = btrim(access_request.display_name)",
    );
    expect(migration).toContain("role.code in ('owner', 'platform_administrator')");
    expect(migration).not.toMatch(/kiran|plazphaze/i);
  });

  it("labels staff authentication plainly", () => {
    const login = source("../app/staff/login/page.tsx");
    expect(login).toContain("<h1>Staff sign in</h1>");
    expect(login).not.toContain("Catalogue operations");
    expect(login).not.toContain("Supabase role assignments");
  });

  it("keeps fixture instructions off public verification and application routes", () => {
    const routes = [
      source("../app/verify/page.tsx"),
      source("../app/verify/dealer/page.tsx"),
      source("../app/verify/license/page.tsx"),
      source("../app/apply/application-forms.tsx"),
    ].join("\n");
    expect(routes).not.toMatch(/fictional development fixture|local database is seeded/i);
  });
});
