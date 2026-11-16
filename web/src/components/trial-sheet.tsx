"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  Clock,
  Wrench,
} from "lucide-react";
import type { TrialResult } from "toolgrade/core";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ms } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TrialSheet({
  taskId,
  prompt,
  trials,
}: {
  taskId: string;
  prompt?: string;
  trials: TrialResult[];
}) {
  const tools = trials.filter((t) => t.arm === "tools");
  const baseline = trials.filter((t) => t.arm === "baseline");
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="ghost" size="sm" className="relative z-10" />}
      >
        Inspect
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle className="font-mono">{taskId}</SheetTitle>
          <SheetDescription>
            {prompt ??
              "Every trial of this task, with each tool call, its result and how each assertion graded it."}
          </SheetDescription>
        </SheetHeader>
        <Tabs defaultValue="tools" className="min-h-0 flex-1">
          <div className="px-4 pt-3">
            <TabsList>
              <TabsTrigger value="tools">
                With tools ({tools.filter((t) => t.passed).length}/
                {tools.length})
              </TabsTrigger>
              {baseline.length > 0 && (
                <TabsTrigger value="baseline">
                  No tools ({baseline.filter((t) => t.passed).length}/
                  {baseline.length})
                </TabsTrigger>
              )}
            </TabsList>
          </div>
          <TabsContent value="tools" className="space-y-3 overflow-y-auto p-4">
            {tools.map((t) => (
              <TrialCard key={t.trial} trial={t} />
            ))}
          </TabsContent>
          {baseline.length > 0 && (
            <TabsContent
              value="baseline"
              className="space-y-3 overflow-y-auto p-4"
            >
              <p className="text-xs text-muted-foreground">
                The baseline is graded on outcome assertions only; tool-use
                assertions are skipped, not failed.
              </p>
              {baseline.map((t) => (
                <TrialCard key={t.trial} trial={t} />
              ))}
            </TabsContent>
          )}
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function TrialCard({ trial }: { trial: TrialResult }) {
  const t = trial.trajectory;
  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {trial.passed ? (
            <CircleCheck className="size-4 text-status-good" aria-hidden />
          ) : (
            <CircleAlert className="size-4 text-status-critical" aria-hidden />
          )}
          Trial {trial.trial} -{" "}
          {trial.passed ? "passed" : trial.error ? "errored" : "failed"}
        </div>
        {t && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Wrench className="size-3.5" aria-hidden />{" "}
              {(t.toolCalls ?? []).length} calls
            </span>
            <span>{t.turns} turns</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {ms(t.durationMs)}
            </span>
          </div>
        )}
      </div>
      <div className="space-y-3 p-3 text-sm">
        {trial.error && <Note tone="critical">{trial.error}</Note>}
        {t?.incomplete && (
          <Note tone="critical">
            Run did not finish normally: {t.incomplete}
          </Note>
        )}

        <section>
          <h4 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Assertions
          </h4>
          <ul className="space-y-1">
            {(trial.assertions ?? []).map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: immutable list from a stored report; position is the identity
              <li key={i} className="flex gap-2">
                {a.passed ? (
                  <CircleCheck
                    className="mt-0.5 size-3.5 shrink-0 text-status-good"
                    aria-label="passed"
                  />
                ) : (
                  <CircleAlert
                    className="mt-0.5 size-3.5 shrink-0 text-status-critical"
                    aria-label="failed"
                  />
                )}
                <span>
                  <span className="font-mono text-xs">{a.type}</span>{" "}
                  <span className="text-muted-foreground">{a.detail}</span>
                </span>
              </li>
            ))}
            {(trial.skipped ?? []).map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: immutable list from a stored report; position is the identity
              <li key={`s${i}`} className="flex gap-2 text-muted-foreground">
                <CircleSlash
                  className="mt-0.5 size-3.5 shrink-0"
                  aria-label="skipped"
                />
                <span>
                  <span className="font-mono text-xs">{s}</span> skipped for the
                  baseline
                </span>
              </li>
            ))}
          </ul>
        </section>

        {t && (t.toolCalls ?? []).length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Trajectory
            </h4>
            <ol className="space-y-2">
              {(t.toolCalls ?? []).map((c, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: call order is the identity of a trajectory step
                <li key={i} className="rounded-md border bg-muted/30">
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 font-mono text-xs">
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">{i + 1}.</span>{" "}
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-muted-foreground">
                        ({JSON.stringify(c.input)})
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0",
                        c.isError
                          ? "text-status-critical"
                          : "text-muted-foreground",
                      )}
                    >
                      {c.isError ? "error" : ms(c.durationMs)}
                    </span>
                  </div>
                  <pre className="max-h-40 overflow-auto border-t px-2.5 py-1.5 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                    {c.output || "(empty)"}
                  </pre>
                </li>
              ))}
            </ol>
          </section>
        )}

        {t && (
          <section>
            <h4 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Final answer
            </h4>
            <p className="rounded-md bg-muted/40 px-2.5 py-2 whitespace-pre-wrap">
              {t.finalText || (
                <span className="text-muted-foreground">(empty)</span>
              )}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

function Note({
  tone,
  children,
}: {
  tone: "critical";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2 text-xs",
        tone === "critical" &&
          "border-status-critical/30 bg-status-critical/10",
      )}
    >
      {children}
    </div>
  );
}
