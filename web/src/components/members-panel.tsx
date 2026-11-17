"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  leaveOrg,
  type MemberActionState,
  removeOrgMember,
  updateOrgMemberRole,
} from "@/app/app/[org]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateTime } from "@/lib/format";
import type { OrgMember } from "@/lib/members";

const ROLES = ["member", "admin", "owner"] as const;

export function MembersPanel({
  orgSlug,
  members,
  currentUserId,
  canManage,
}: {
  orgSlug: string;
  members: OrgMember[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [pending, startAction] = useTransition();
  const ownerCount = members.filter((m) => m.role === "owner").length;

  function run(
    action: () => Promise<MemberActionState>,
    successMessage: string,
    onSuccess?: () => void,
  ) {
    startAction(async () => {
      const res = await action();
      if (res.ok) {
        toast.success(successMessage);
        onSuccess?.();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="hidden sm:table-cell">Joined</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((m) => {
          const isSelf = m.userId === currentUserId;
          const isLastOwner = m.role === "owner" && ownerCount <= 1;

          return (
            <TableRow key={m.id}>
              <TableCell>
                <div className="font-medium">
                  {m.name}
                  {isSelf && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{m.email}</div>
              </TableCell>
              <TableCell>
                {canManage && !isLastOwner ? (
                  <select
                    defaultValue={m.role}
                    disabled={pending}
                    onChange={(e) =>
                      run(
                        () =>
                          updateOrgMemberRole(
                            orgSlug,
                            m.id,
                            e.target.value as (typeof ROLES)[number],
                          ),
                        `Updated ${m.name}'s role`,
                      )
                    }
                    className="h-8 rounded-md border bg-transparent px-2 text-sm capitalize"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Badge variant="outline" className="capitalize">
                    {m.role}
                  </Badge>
                )}
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {dateTime(m.createdAt)}
              </TableCell>
              <TableCell className="text-right">
                {isSelf ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending || isLastOwner}
                    title={
                      isLastOwner
                        ? "Transfer ownership before leaving"
                        : undefined
                    }
                    onClick={() =>
                      run(
                        () => leaveOrg(orgSlug),
                        "Left the organization",
                        () => {
                          window.location.href = "/app";
                        },
                      )
                    }
                  >
                    Leave
                  </Button>
                ) : (
                  canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || isLastOwner}
                      title={
                        isLastOwner
                          ? "Transfer ownership before removing"
                          : undefined
                      }
                      onClick={() =>
                        run(
                          () => removeOrgMember(orgSlug, m.email),
                          `Removed ${m.name}`,
                        )
                      }
                    >
                      Remove
                    </Button>
                  )
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
