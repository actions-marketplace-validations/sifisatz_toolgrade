import { describe, expect, it } from "vitest";
import {
  leaveOrg,
  removeOrgMember,
  updateOrgMemberRole,
} from "@/app/app/[org]/actions";

// Like settings/actions.ts's own tests (see review-fixes.test.ts): a malformed org slug fails
// before any session lookup, which is as far as these can be exercised without a real request
// context (getSession() needs next/headers(), unavailable outside one). Authorization itself -
// owner/admin only, never the org's last owner - is Better Auth's organization plugin's own
// policy (auth.api.removeMember/updateMemberRole/leaveOrganization), not reimplemented here.
describe("org member actions reject a malformed org slug before touching the session", () => {
  it("removeOrgMember", async () => {
    expect(await removeOrgMember("../x", "someone@example.com")).toEqual({
      ok: false,
      error: "Organization not found.",
    });
  });

  it("updateOrgMemberRole", async () => {
    expect(await updateOrgMemberRole("../x", "member-id", "admin")).toEqual({
      ok: false,
      error: "Organization not found.",
    });
  });

  it("leaveOrg", async () => {
    expect(await leaveOrg("../x")).toEqual({
      ok: false,
      error: "Organization not found.",
    });
  });
});
