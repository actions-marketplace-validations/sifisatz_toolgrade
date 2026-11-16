"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={copied ? "Copied" : label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

export function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative rounded-lg border bg-muted/40">
      {label && (
        <div className="border-b px-3 py-1.5 font-mono text-xs text-muted-foreground">
          {label}
        </div>
      )}
      <div className="absolute top-1 right-1">
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto p-3 pr-10 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
