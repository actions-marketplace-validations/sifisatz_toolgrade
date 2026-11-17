"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * A single irreversible-action card: nothing fires until the confirm value is typed exactly,
 * checked again server-side by `onDelete` itself - this is a UX guard against fat-fingering, not
 * the real safety check.
 */
export function DangerZone({
  title,
  description,
  confirmLabel,
  confirmValue,
  onDelete,
  onDeleted,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmValue: string;
  onDelete: (confirmText: string) => Promise<{ ok: boolean; error?: string }>;
  onDeleted: () => void;
}) {
  const [input, setInput] = useState("");
  const [pending, startAction] = useTransition();
  const matches = input === confirmValue;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor="confirm-delete">
            Type <span className="font-mono">{confirmValue}</span> to confirm
          </Label>
          <Input
            id="confirm-delete"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            className="max-w-xs"
          />
        </div>
        <Button
          variant="destructive"
          disabled={!matches || pending}
          onClick={() =>
            startAction(async () => {
              const res = await onDelete(input);
              if (res.ok) onDeleted();
              else toast.error(res.error ?? "Something went wrong.");
            })
          }
        >
          {pending ? "Deleting..." : confirmLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
