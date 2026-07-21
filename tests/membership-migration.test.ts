import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migration(name: string) {
  return readFileSync(resolve(process.cwd(), "database/migrations", name), "utf8");
}

describe("membership database contract", () => {
  const membership = migration("0100_consultant_marketing_membership.sql");
  const reservationFix = migration("0101_fix_membership_reservation.sql");
  const core = migration("0102_consultant_marketing_core.sql");
  const refresh = migration("0103_membership_period_refresh.sql");
  const combined = [membership, reservationFix, core, refresh].join("\n");

  it("keeps application tables out of the shared public schema", () => {
    expect(combined).toContain("create schema if not exists consultant_marketing");
    expect(combined).not.toMatch(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\./i);
    expect(combined).not.toMatch(/alter\s+table\s+public\./i);
  });

  it("seeds the approved Trial, Basic and Pro commercial rules", () => {
    expect(membership).toMatch(/'trial',[\s\S]*?'one_time',[\s\S]*?8900,[\s\S]*?null,[\s\S]*?5,[\s\S]*?10,[\s\S]*?30,[\s\S]*?false/);
    expect(membership).toMatch(/'basic',[\s\S]*?'recurring',[\s\S]*?10900,[\s\S]*?8900,[\s\S]*?20,[\s\S]*?25,[\s\S]*?null,[\s\S]*?true/);
    expect(membership).toMatch(/'pro',[\s\S]*?'recurring',[\s\S]*?16900,[\s\S]*?10900,[\s\S]*?45,[\s\S]*?60,[\s\S]*?null,[\s\S]*?true/);
  });

  it("enforces membership access on projects and generated history", () => {
    expect(core).toContain("consultant_marketing.can_access_app(auth.uid())");
    expect(core).toContain("cm_projects_select_active_own");
    expect(core).toContain("cm_assets_select_active_own");
    expect(core).toContain("cm_messages_select_active_own");
  });

  it("keeps quota changes atomic and supports activation-day rollover", () => {
    expect(reservationFix).toContain("for update of m, s");
    expect(reservationFix).toContain("for update;");
    expect(refresh).toContain("while v_period_end <= now() loop");
    expect(refresh).toContain("copy_used = 0");
    expect(refresh).toContain("image_used = 0");
    expect(refresh).toContain("monthly_quota_reset");
  });

  it("keeps administrative RPCs unavailable to normal authenticated clients", () => {
    expect(combined).toContain("revoke all on function consultant_marketing.activate_membership");
    expect(combined).toContain("revoke all on function consultant_marketing.reserve_usage");
    expect(combined).toContain("revoke all on function consultant_marketing.refresh_membership_period");
    expect(combined).toContain("to service_role");
  });
});
