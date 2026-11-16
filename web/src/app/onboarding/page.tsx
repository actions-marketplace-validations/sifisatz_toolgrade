import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { OnboardingForm } from "@/components/onboarding-form";
import { Skeleton } from "@/components/ui/skeleton";
import { listUserOrgs } from "@/lib/data";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Set up your workspace" };

export default function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-10">
      <Logo />
      <div className="mt-16 w-full max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your workspace
        </h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          Two names and you are ready to connect CI.
        </p>
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Onboarding searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [user, query] = await Promise.all([requireUser(), searchParams]);
  const orgs = await listUserOrgs(user.id);
  // First-time users only; "New workspace" in the account menu passes ?new=1.
  if (orgs.length > 0 && !query.new) redirect(`/app/${orgs[0]!.slug}`);
  return (
    <OnboardingForm
      defaultWorkspace={orgs.length ? "" : `${user.name}'s workspace`}
    />
  );
}
