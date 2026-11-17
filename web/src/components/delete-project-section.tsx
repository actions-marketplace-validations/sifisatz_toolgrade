"use client";

import { deleteProject } from "@/app/app/[org]/[project]/settings/actions";
import { DangerZone } from "@/components/danger-zone";

export function DeleteProjectSection({
  orgSlug,
  projectSlug,
}: {
  orgSlug: string;
  projectSlug: string;
}) {
  return (
    <DangerZone
      title="Delete this project"
      description="Permanently deletes this project, its API keys, and every run on record. This cannot be undone."
      confirmLabel="Delete project"
      confirmValue={projectSlug}
      onDelete={(confirmText) =>
        deleteProject(orgSlug, projectSlug, confirmText)
      }
      onDeleted={() => {
        window.location.href = `/app/${orgSlug}`;
      }}
    />
  );
}
