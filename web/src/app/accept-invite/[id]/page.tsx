import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AcceptInvitePanel } from "@/components/accept-invite-panel";
import { Logo } from "@/components/logo";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAuth } from "@/lib/auth";
import { getSession } from "@/lib/session";

export const metadata = { title: "Accept invitation" };

export default function AcceptInvitePage({
  params,
}: PageProps<"/accept-invite/[id]">) {
  return (
    <Shell>
      <Suspense fallback={<Skeleton className="h-40" />}>
        <AcceptInvite params={params} />
      </Suspense>
    </Shell>
  );
}

async function AcceptInvite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session)
    redirect(`/sign-in?next=${encodeURIComponent(`/accept-invite/${id}`)}`);

  const auth = await getAuth();
  let invitation: Awaited<ReturnType<typeof auth.api.getInvitation>>;
  try {
    invitation = await auth.api.getInvitation({
      query: { id },
      headers: await headers(),
    });
  } catch (err) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {err instanceof Error
            ? err.message
            : "This invitation link is no longer valid."}
        </CardContent>
      </Card>
    );
  }

  return (
    <AcceptInvitePanel
      invitationId={invitation.id}
      organizationName={invitation.organizationName}
      organizationSlug={invitation.organizationSlug}
      inviterEmail={invitation.inviterEmail}
      role={invitation.role}
    />
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <Logo />
      <div className="mt-16 w-full max-w-md">{children}</div>
    </div>
  );
}
