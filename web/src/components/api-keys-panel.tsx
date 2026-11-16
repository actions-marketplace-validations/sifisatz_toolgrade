"use client";

import { KeyRound, Trash2 } from "lucide-react";
import { useActionState, useTransition } from "react";
import { toast } from "sonner";
import {
  type CreateKeyState,
  createApiKey,
  revokeApiKey,
} from "@/app/app/[org]/[project]/settings/actions";
import { CopyButton } from "@/components/copy-button";
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

interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export function ApiKeysPanel({
  orgSlug,
  projectSlug,
  keys,
}: {
  orgSlug: string;
  projectSlug: string;
  keys: KeyRow[];
}) {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(
    createApiKey.bind(null, orgSlug, projectSlug),
    {},
  );
  const [revoking, startRevoke] = useTransition();
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="key-name">New key name</Label>
          <Input
            id="key-name"
            name="name"
            placeholder="github-actions"
            className="w-64"
            maxLength={80}
          />
        </div>
        <Button type="submit" disabled={pending}>
          <KeyRound /> {pending ? "Creating..." : "Create API key"}
        </Button>
      </form>
      {state.error && (
        <p className="text-sm text-status-critical">{state.error}</p>
      )}
      {state.key && (
        <div className="rounded-lg border border-status-warning/40 bg-status-warning/10 p-3 text-sm">
          <div className="font-medium">
            Copy this key now - it is stored hashed and will not be shown again.
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-md border bg-background px-2 py-1 font-mono text-xs">
            <span className="min-w-0 flex-1 truncate">{state.key}</span>
            <CopyButton value={state.key} label="Copy API key" />
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Revoke</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                No active keys.
              </TableCell>
            </TableRow>
          )}
          {keys.map((k) => (
            <TableRow key={k.id}>
              <TableCell className="font-medium">{k.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {k.prefix}...
              </TableCell>
              <TableCell className="text-muted-foreground">
                {k.createdAt.toLocaleDateString()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {k.lastUsedAt ? k.lastUsedAt.toLocaleString() : "never"}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoking}
                  onClick={() =>
                    startRevoke(async () => {
                      const res = await revokeApiKey(
                        orgSlug,
                        projectSlug,
                        k.id,
                      );
                      if (res.ok) toast.success(`Revoked "${k.name}"`);
                      else toast.error(res.error ?? "Could not revoke the key");
                    })
                  }
                >
                  <Trash2 /> Revoke
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
