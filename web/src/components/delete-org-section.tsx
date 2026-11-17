"use client";

import { deleteOrg } from "@/app/app/[org]/actions";
import { DangerZone } from "@/components/danger-zone";

export function DeleteOrgSection({ orgSlug }: { orgSlug: string }) {
  return (
    <DangerZone
      title="Delete this organization"
      description="Permanently deletes every project, API key, and run under this organization, and cancels any active subscription. This cannot be undone."
      confirmLabel="Delete organization"
      confirmValue={orgSlug}
      onDelete={(confirmText) => deleteOrg(orgSlug, confirmText)}
      onDeleted={() => {
        window.location.href = "/app";
      }}
    />
  );
}
