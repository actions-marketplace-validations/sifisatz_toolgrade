import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Not found" };

/**
 * Renders in place of this segment's content when a project/run/compare/settings page calls
 * notFound() - the sidebar (from this segment's layout.tsx) keeps rendering, since the org itself
 * resolved fine. An invalid org bubbles past this file to the root not-found.tsx instead, since
 * it's the org layout itself that would have thrown.
 */
export default function OrgNotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <CompassIcon className="size-10 text-muted-foreground" aria-hidden />
      <div>
        <h1 className="text-xl font-semibold">Not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          That project, run or page doesn&apos;t exist, or you don&apos;t have
          access to it.
        </p>
      </div>
      <Button variant="outline" render={<Link href="/app" />}>
        Back to your workspaces
      </Button>
    </div>
  );
}
