import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MembersPanel } from "@/components/members-panel";
import type { OrgMember } from "@/lib/members";

function member(overrides: Partial<OrgMember>): OrgMember {
  return {
    id: "m1",
    userId: "u1",
    name: "Alice",
    email: "alice@example.com",
    role: "member",
    createdAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function html(members: OrgMember[], currentUserId: string, canManage: boolean) {
  return renderToStaticMarkup(
    createElement(MembersPanel, {
      orgSlug: "acme",
      members,
      currentUserId,
      canManage,
    }),
  );
}

describe("MembersPanel", () => {
  it("shows a disabled Leave button with no role control for the organization's sole owner", () => {
    const owner = member({ id: "m1", userId: "u1", role: "owner" });
    const out = html([owner], "u1", true);
    const leaveButton = /<button[^>]*>Leave<\/button>/.exec(out);
    // A real disabled attribute (not the "disabled:" Tailwind class-variant prefix) is `disabled=""`.
    expect(leaveButton?.[0]).toContain('disabled=""');
    expect(out).not.toContain("<select");
  });

  it("offers a role select and an enabled Remove for a non-owner when the caller can manage", () => {
    const owner = member({
      id: "m1",
      userId: "u1",
      name: "Alice",
      role: "owner",
    });
    const regular = member({
      id: "m2",
      userId: "u2",
      name: "Bob",
      email: "bob@example.com",
      role: "member",
    });
    const out = html([owner, regular], "u1", true);
    expect(out).toContain("<select");
    expect(out).toContain("Bob");
    expect(out).toContain("Remove");
  });

  it("hides management controls entirely for a caller who is not owner/admin", () => {
    const owner = member({ id: "m1", userId: "u1", role: "owner" });
    const regular = member({
      id: "m2",
      userId: "u2",
      name: "Bob",
      email: "bob@example.com",
      role: "member",
    });
    const out = html([owner, regular], "u2", false);
    expect(out).not.toContain("<select");
    expect(out).not.toContain(">Remove<");
  });

  it("shows an enabled Leave for a non-sole owner", () => {
    const ownerA = member({ id: "m1", userId: "u1", role: "owner" });
    const ownerB = member({
      id: "m2",
      userId: "u2",
      name: "Bob",
      email: "bob@example.com",
      role: "owner",
    });
    const out = html([ownerA, ownerB], "u1", true);
    const leaveButton = /<button[^>]*>Leave<\/button>/.exec(out);
    expect(leaveButton?.[0]).toBeDefined();
    // A real disabled attribute (not the "disabled:" Tailwind class-variant prefix) is `disabled=""`.
    expect(leaveButton?.[0]).not.toContain('disabled=""');
  });
});
