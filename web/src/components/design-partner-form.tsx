"use client";

import { CircleCheck } from "lucide-react";
import { useActionState } from "react";
import {
  type ApplyState,
  applyAsDesignPartner,
} from "@/app/design-partners/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DesignPartnerForm() {
  const [state, action, pending] = useActionState<ApplyState, FormData>(
    applyAsDesignPartner,
    {},
  );

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-10 text-center">
        <CircleCheck className="size-8 text-status-good" aria-hidden />
        <div className="font-medium">Application received</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          We read every one by hand. If it looks like a fit, we'll email you to
          set up a short call.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-6">
      {/* Hidden from sighted users via CSS, not display:none, so a careless bot that only checks
          visibility="hidden" or opacity still falls for it; empty on submit is the honeypot. */}
      <div className="absolute -left-[9999px]" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={120} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={254}
          />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="company">Company (optional)</Label>
        <Input id="company" name="company" maxLength={120} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="mcpServer">What MCP server are you shipping?</Label>
        <Textarea
          id="mcpServer"
          name="mcpServer"
          required
          maxLength={2000}
          placeholder="What it does, how many tools, who uses it, and what you're currently unsure of."
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="notes">Anything else? (optional)</Label>
        <Textarea id="notes" name="notes" maxLength={2000} />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Sending..." : "Apply"}
      </Button>
    </form>
  );
}
