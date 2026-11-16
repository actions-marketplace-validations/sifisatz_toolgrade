"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { signInAsDemo } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/** Only same-site paths are honoured as a post-sign-in destination (no open redirects). */
function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/app";
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [demoPending, startDemo] = useTransition();

  function submit(form: FormData) {
    setError(undefined);
    start(async () => {
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const res =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name:
                String(form.get("name") ?? "").trim() || email.split("@")[0]!,
            });
      if (res.error) {
        setError(res.error.message ?? "Something went wrong. Try again.");
        return;
      }
      router.push(mode === "sign-up" ? "/onboarding" : next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form action={submit} className="space-y-4">
        {mode === "sign-up" && (
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Ada Lovelace"
              maxLength={100}
            />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@company.com"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            required
            minLength={mode === "sign-up" ? 10 : undefined}
            placeholder={
              mode === "sign-up" ? "At least 10 characters" : undefined
            }
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-status-critical">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending
            ? "Please wait..."
            : mode === "sign-in"
              ? "Sign in"
              : "Create account"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or{" "}
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        size="lg"
        disabled={demoPending}
        onClick={() =>
          startDemo(async () => {
            const res = await signInAsDemo();
            if (res?.error) setError(res.error);
          })
        }
      >
        <FlaskConical />{" "}
        {demoPending ? "Opening the demo..." : "Explore the demo workspace"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-in" ? (
          <>
            New to ToolGrade?{" "}
            <Link
              href="/sign-up"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
