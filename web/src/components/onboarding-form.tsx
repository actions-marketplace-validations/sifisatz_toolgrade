"use client";

import { useActionState } from "react";
import {
  createWorkspace,
  type OnboardingState,
} from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm({
  defaultWorkspace,
}: {
  defaultWorkspace: string;
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    createWorkspace,
    {},
  );
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-1.5">
        <Label htmlFor="workspace">Workspace</Label>
        <Input
          id="workspace"
          name="workspace"
          defaultValue={defaultWorkspace}
          required
          maxLength={60}
        />
        <p className="text-xs text-muted-foreground">
          Usually your company or team. You can invite teammates later.
        </p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="project">First MCP server</Label>
        <Input
          id="project"
          name="project"
          placeholder="e.g. Billing MCP server"
          required
          maxLength={60}
        />
        <p className="text-xs text-muted-foreground">
          One project per tool surface you want to grade.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-status-critical">
          {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating..." : "Create workspace"}
      </Button>
    </form>
  );
}
