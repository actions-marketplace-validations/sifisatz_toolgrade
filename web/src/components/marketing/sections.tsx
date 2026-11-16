import { ArrowRight, Check, CircleCheck } from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/copy-button";
import { Logo } from "@/components/logo";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CTA } from "@/lib/site";
import { InView } from "./primitives";
import { SectionHeading } from "./section-heading";
import { TerminalDemo } from "./terminal-demo";

const STEPS = [
  {
    title: "Point it at your server",
    text: "toolgrade init reads your MCP server's tools, lints their descriptions and scaffolds a suite.",
    code: "npx toolgrade init -- node dist/server.js",
  },
  {
    title: "Write real tasks",
    text: "Prompts a real user would send, plus outcome checks against the server's actual state. Placeholders are refused.",
  },
  {
    title: "Run in CI",
    text: "Each task runs with your tools and with none, N times. Pass rate, lift and a regression check set the exit code.",
  },
  {
    title: "Watch the trend",
    text: "Every run uploads to your workspace: history, trial-level trajectories, and run-to-run compare.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading
            center={false}
            eyebrow="How it works"
            title="From MCP server to CI gate in four steps"
          />
          <InView as="ol" className="mt-10 space-y-6">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                className="seq relative flex gap-4"
                style={{ "--i": i } as React.CSSProperties}
              >
                <div className="flex flex-col items-center">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-semibold">
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="mt-2 w-px flex-1 bg-border" aria-hidden />
                  )}
                </div>
                <div className="pb-2">
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
                  {s.code && (
                    <code className="mt-2 inline-block rounded-md border bg-background px-2 py-1 font-mono text-xs">
                      {s.code}
                    </code>
                  )}
                </div>
              </li>
            ))}
          </InView>
        </div>
        <div className="reveal lg:pt-10">
          <TerminalDemo />
        </div>
      </div>
    </section>
  );
}

const MEASURED = [
  {
    value: "+61pp",
    label: "lift over no tools",
    detail: "95% CI +5..+83pp, qwen3:8b, 6 tasks x 3 trials",
  },
  {
    value: "78%",
    label: "pass rate with tools",
    detail: "14 of 18 trials; the 80% gate still failed it",
  },
  {
    value: "100% -> 33%",
    label: "drop caught",
    detail: "same agent, vaguer tool descriptions (demo suite)",
  },
  {
    value: "$0",
    label: "to grade locally",
    detail: "Ollama on a 24 GB laptop, no API key",
  },
];

export function Measured() {
  return (
    <section
      id="measured"
      className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24"
    >
      <SectionHeading
        eyebrow="Measured, not claimed"
        title="Numbers from real runs"
        text="Every figure on this page comes from the ToolGrade engine run against its example MCP server on 2026-11-16 - model, sample size and interval included."
      />
      <InView className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {MEASURED.map((m, i) => (
          <div
            key={m.label}
            className="seq bg-card p-6"
            style={{ "--i": i } as React.CSSProperties}
          >
            <div className="text-3xl font-semibold tracking-tight">
              {m.value}
            </div>
            <div className="mt-1 text-sm font-medium">{m.label}</div>
            <div className="mt-2 text-xs text-muted-foreground">{m.detail}</div>
          </div>
        ))}
      </InView>
    </section>
  );
}

const INTEGRATIONS = [
  "Claude",
  "OpenAI-compatible APIs",
  "Ollama",
  "Gemini (OpenAI endpoint)",
  "Groq",
  "GitHub Actions",
  "MCP stdio",
  "MCP Streamable HTTP",
  "Node.js 20+",
  "Postgres",
  "Docker-free local mode",
  "pnpm / npm",
];

export function WorksWith() {
  return (
    <section className="border-y py-10" aria-label="Works with">
      <p className="text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Works with
      </p>
      <div className="marquee mt-6 overflow-hidden">
        <div className="marquee-track">
          {[...INTEGRATIONS, ...INTEGRATIONS].map((name, i) => (
            <span
              key={`${i < INTEGRATIONS.length ? "a" : "b"}-${name}`}
              aria-hidden={i >= INTEGRATIONS.length}
              className="rounded-full border bg-background px-4 py-1.5 text-sm whitespace-nowrap text-muted-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

const METHODS = [
  {
    title: "Two arms, same tasks",
    text: "The no-tool baseline is graded on outcomes only, so lift means better results - not just 'called a tool'.",
  },
  {
    title: "Tasks are the sample",
    text: "Trials of one task are correlated. Suite intervals use tasks as n: conservative by design, so a green gate means something.",
  },
  {
    title: "Wilson and Newcombe",
    text: "Wilson intervals behave at 0% and 100%; Newcombe's hybrid score interval puts honest bounds on the lift.",
  },
  {
    title: "Bonferroni on compare",
    text: "Per-task regression verdicts are corrected for the number of tasks, so a 50-task suite does not cry wolf.",
  },
  {
    title: "Outcomes over claims",
    text: "State checks call your server after the run. An agent that says 'done' but did nothing fails.",
  },
  {
    title: "Fresh server per trial",
    text: "Each stdio trial spawns a new process; nothing leaks between trials or arms, and your model key never reaches it.",
  },
];

export function Methodology() {
  return (
    <section id="methodology" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeading
          eyebrow="Methodology"
          title="Statistics you can defend in a design review"
        />
        <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {METHODS.map((m) => (
            <div key={m.title} className="reveal flex gap-3">
              <CircleCheck
                className="mt-0.5 size-5 shrink-0 text-chart-1"
                aria-hidden
              />
              <div>
                <h3 className="font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="reveal mx-auto mt-14 max-w-3xl">
          <CodeBlock
            label="evals/suite.yaml"
            code={`tasks:
  - id: delete-note
    prompt: Delete the vendor contracts note, it is obsolete.
    assert:
      - { type: tool_called, name: delete_note }
      - { type: state, tool: search_notes, args: { query: Vendor contracts }, not_contains: Vendor contracts }`}
          />
        </div>
      </div>
    </section>
  );
}

const PLANS = [
  {
    name: "Open source",
    price: "Free",
    per: "",
    text: "The CLI and GitHub Action. Local reports, your own model keys.",
    items: [
      "Unlimited local runs",
      "CI gate and PR summary",
      "Any model provider",
    ],
    cta: { label: "Read the quickstart", href: "#how-it-works" },
  },
  {
    name: "Team",
    price: "$49",
    per: "per project / month",
    text: "The hosted platform for teams shipping MCP servers.",
    items: [
      "Run history and trends",
      "Trajectory viewer and compare",
      "Workspaces, roles and API keys",
      "Unlimited members",
    ],
    featured: true,
    cta: CTA.primary,
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    text: "For platforms with many tool surfaces.",
    items: ["SSO and audit log", "VPC runners", "Shared task libraries"],
    cta: CTA.enterprise,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
      <SectionHeading
        eyebrow="Pricing"
        title="Free to start, priced per tool surface"
        text="Indicative pricing for the early-access programme. Nothing is billed during early access."
      />
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div
            key={p.name}
            className={`reveal relative flex flex-col rounded-2xl border bg-card p-6 ${p.featured ? "shadow-xl shadow-chart-1/10 ring-2 ring-chart-1" : ""}`}
          >
            {p.featured && (
              <span className="absolute -top-3 left-6 rounded-full bg-chart-1 px-2.5 py-0.5 text-xs font-medium text-white">
                Most teams
              </span>
            )}
            <div className="text-sm font-medium text-muted-foreground">
              {p.name}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight">
                {p.price}
              </span>
              {p.per && (
                <span className="text-sm text-muted-foreground">{p.per}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              {p.items.map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check className="size-4 text-chart-1" aria-hidden /> {i}
                </li>
              ))}
            </ul>
            <Button
              className={`mt-8 ${p.featured ? "shine" : ""}`}
              variant={p.featured ? "default" : "outline"}
              render={<Link href={p.cta.href} />}
            >
              {p.cta.label}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: "What exactly does ToolGrade measure?",
    a: "Whether an agent completes real tasks better with your MCP server's tools than the same agent with no tools. You get pass rates with 95% intervals, the lift over the baseline, cost per run, and a gate verdict.",
  },
  {
    q: "Do I need an API key to try it?",
    a: "No. The CLI grades with any OpenAI-compatible endpoint, including a local model through Ollama. The numbers on this page include a run with qwen3:8b on a laptop.",
  },
  {
    q: "How is this different from a general LLM eval platform?",
    a: "ToolGrade's unit under test is your tool surface. It runs a no-tool baseline arm, re-spawns your server for every trial, and can check the server's real state after the run - first-class, not glue code.",
  },
  {
    q: "Does my model key reach the server under test?",
    a: "No. Stdio servers start with a minimal environment plus only the variables your suite declares.",
  },
  {
    q: "Why do the confidence intervals look wide?",
    a: "Because they are honest. Trials of the same task are correlated, so ToolGrade treats each task as one observation. More tasks tighten the interval; more trials of the same task do not.",
  },
  {
    q: "Is it open source?",
    a: "The CLI and the GitHub Action are. The hosted platform adds history, trends, trajectories, compare and team workspaces.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 border-t bg-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <SectionHeading eyebrow="FAQ" title="Questions teams ask first" />
        <Accordion className="reveal mt-10">
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left text-base">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t">
      <div
        className="cta-glow pointer-events-none absolute inset-0 -z-10"
        aria-hidden
      />
      <div className="reveal mx-auto max-w-3xl px-6 py-28 text-center">
        <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Ship tool changes on evidence.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Connect a server, write five real tasks, and get your first lift
          number today.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button
            size="lg"
            className="shine h-11 px-6"
            render={<Link href={CTA.primary.href} />}
          >
            {CTA.primary.label} <ArrowRight />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 px-6"
            render={<Link href={CTA.demo.href} />}
          >
            {CTA.demo.label}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        ["Features", "#product"],
        ["How it works", "#how-it-works"],
        ["Pricing", "#pricing"],
      ],
    },
    {
      title: "Learn",
      links: [
        ["Methodology", "#methodology"],
        ["FAQ", "#faq"],
        ["Measured results", "#measured"],
      ],
    },
    {
      title: "Account",
      links: [
        [CTA.signIn.label, CTA.signIn.href],
        [CTA.primary.label, CTA.primary.href],
        [CTA.demo.label, CTA.demo.href],
      ],
    },
  ];
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Eval-first quality gates for MCP servers. Early access.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <div className="text-sm font-medium">{c.title}</div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link
                    href={href!}
                    className="transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 px-6 py-5 text-xs text-muted-foreground">
          <span>ToolGrade - early access</span>
          <span>
            Numbers on this page: ToolGrade engine, example notes server,
            2026-11-16.
          </span>
        </div>
      </div>
    </footer>
  );
}
