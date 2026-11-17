"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  cancelInvitation,
  inviteMember,
  type MemberActionState,
} from "@/app/app/[org]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dateTime } from "@/lib/format";
import type { PendingInvitation } from "@/lib/invitations";

const ROLES = ["member", "admin"] as const;

export function InvitePanel({
  orgSlug,
  invitations,
}: {
  orgSlug: string;
  invitations: PendingInvitation[];
}) {
  const [pending, startAction] = useTransition();
  const [role, setRole] = useState<(typeof ROLES)[number]>("member");
  const [link, setLink] = useState<string>();

  function run(
    action: () => Promise<MemberActionState>,
    successMessage: string,
  ) {
    startAction(async () => {
      const res = await action();
      if (res.ok) toast.success(successMessage);
      else toast.error(res.error ?? "Something went wrong.");
    });
  }

  function invite(form: FormData) {
    setLink(undefined);
    const email = String(form.get("email") ?? "").trim();
    if (!email) return;
    startAction(async () => {
      const res = await inviteMember(orgSlug, email, role);
      if (res.ok && res.invitationId) {
        setLink(`${window.location.origin}/accept-invite/${res.invitationId}`);
        toast.success(`Invited ${email}`);
      } else {
        toast.error(res.error ?? "Could not send the invitation.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <form action={invite} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="invite-email">Invite by email</Label>
          <Input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="name@company.com"
            className="w-64"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-role">Role</Label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            className="h-9 rounded-md border bg-transparent px-2 text-sm capitalize"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send invitation"}
        </Button>
      </form>

      {link && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="text-muted-foreground">
            There's no outbound email yet - share this link with them directly:
          </div>
          <code className="mt-1 block truncate font-mono text-xs">{link}</code>
        </div>
      )}

      {invitations.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Expires</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.email}</TableCell>
                <TableCell className="capitalize">{i.role}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {dateTime(i.expiresAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => cancelInvitation(orgSlug, i.id),
                        `Cancelled the invitation to ${i.email}`,
                      )
                    }
                  >
                    Cancel
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
