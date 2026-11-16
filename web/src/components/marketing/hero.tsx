import { ArrowRight, Sparkles, Terminal } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CTA } from "@/lib/site";
import { HeroReplay } from "./hero-replay";

/** Headline and CTAs are server-rendered at full opacity (fast LCP); only the product card moves. */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="bg-grid pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      />
      <div
        className="hero-glow pointer-events-none absolute -top-40 left-1/2 -z-10 h-[38rem] w-[70rem] -translate-x-1/2"
        aria-hidden
      />
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pt-16 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-24 lg:pb-28">
        <div>
          <a
            href="#measured"
            className="group inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
          >
            <Sparkles className="size-3.5 text-chart-1" aria-hidden />
            Early access - eval-first quality gates for MCP servers
            <ArrowRight
              className="size-3 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </a>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Know whether your tools make agents{" "}
            <span className="bg-gradient-to-r from-chart-1 to-chart-2 bg-clip-text text-transparent">
              better.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-pretty text-muted-foreground">
            ToolGrade runs every task with your MCP server and without it,
            grades what actually happened, and reports the lift with confidence
            intervals - on every pull request.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="shine h-11 px-5"
              render={<Link href={CTA.primary.href} />}
            >
              {CTA.primary.label} <ArrowRight />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-5"
              render={<Link href={CTA.demo.href} />}
            >
              {CTA.demo.label}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="h-11 px-4"
              render={<Link href="#how-it-works" />}
            >
              <Terminal /> See the CLI
            </Button>
          </div>
          <p className="mt-5 text-xs text-muted-foreground">
            Open-source CLI. Claude, OpenAI-compatible APIs and local models. No
            credit card.
          </p>
        </div>
        <HeroReplay />
      </div>
    </section>
  );
}
