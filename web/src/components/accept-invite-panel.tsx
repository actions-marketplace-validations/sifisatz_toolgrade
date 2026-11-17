"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  acceptInvitation,
  rejectInvitation,
} from "@/app/accept-invite/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function AcceptInvitePanel({
  invitationId,
  organizationName,
  organizationSlug,
  inviterEmail,
  role,
}: {
  invitationId: string;
  organizationName: string;
  organizationSlug: string;
  inviterEmail: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, startAction] = useTransition();

  return (
    <Card>
      <CardContent className="space-y-4 py-8 text-center">
        <p>
          <span className="font-medium">{inviterEmail}</span> invited you to
          join <span className="font-medium">{organizationName}</span> as a{" "}
          <span className="capitalize">{role}</span>.
        </p>
        <div className="flex justify-center gap-3">
          <Button
            disabled={pending}
            onClick={() =>
              startAction(async () => {
                const res = await acceptInvitation(invitationId);
                if (res.ok) {
                  toast.success(`Joined ${organizationName}`);
                  router.push(`/app/${organizationSlug}`);
                } else {
                  toast.error(res.error ?? "Could not accept the invitation.");
                }
              })
            }
          >
            Accept
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              startAction(async () => {
                const res = await rejectInvitation(invitationId);
                if (res.ok) {
                  toast.success("Declined");
                  router.push("/app");
                } else {
                  toast.error(res.error ?? "Could not decline the invitation.");
                }
              })
            }
          >
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
