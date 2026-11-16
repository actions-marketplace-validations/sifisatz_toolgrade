import {
  ArrowRight,
  BadgeCheck,
  Beaker,
  ChartLine,
  CircleAlert,
  CircleCheck,
  Coins,
  Eye,
  GitCompareArrows,
  ShieldCheck,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/copy-button";
import { Dumbbell, DumbbellLegend } from "@/components/dumbbell";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";

// Numbers from a real run: qwen3:8b via Ollama on examples/notes-suite.yaml, 3 trials per task.
const REAL_RUN = {
  model: "qwen3:8b",
  passRate: 0.78,
  passCi: "39-95%",
  baseline: 0.17,
  lift: "+61pp",
  liftCi: "+5..+83pp",
  tasks: [
    { id: "find-owner", tools: 1, baseline: 0 },
    { id: "create-note", tools: 1, baseline: 0 },
    { id: "delete-note", tools: 1, baseline: 0 },
    { id: "summarize-plan", tools: 0.67, baseline: 0 },
    { id: "incident-root-cause", tools: 0, baseline: 0 },
    { id: "no-tool-needed", tools: 1, baseline: 1 },
  ],
};

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Logo />
          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#how-it-works" className="hover:text-foreground">
              How it works
            </a>
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Button size="sm" render={<Link href="/app" />}>
              Open live demo <ArrowRight />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5" aria-hidden /> Eval-first quality
              gates for MCP servers
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Know whether your tools make agents better.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-pretty text-muted-foreground">
              ToolGrade runs your tasks with your MCP server and without it,
              grades what actually happened, and tells you the lift - with
              confidence intervals - on every pull request.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" render={<Link href="/app" />}>
                Explore the demo workspace <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<Link href="#get-started" />}
              >
                <Terminal /> Run it locally
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Open-source CLI. Works with Claude, OpenAI-compatible endpoints
              and local models.
            </p>
          </div>
          <HeroResult />
        </section>

        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-3">
            {[
              {
                Icon: Eye,
                title: "Shipped on vibes",
                text: "Every platform now ships an MCP server. Almost none can show that it helps an agent finish real tasks.",
              },
              {
                Icon: CircleAlert,
                title: "Silent regressions",
                text: "A shorter tool description, a new model version - quality moves and nobody notices until users do.",
              },
              {
                Icon: Beaker,
                title: "No baseline",
                text: "A tool that does not beat the same agent with no tools is a cost: schema tokens, latency and distraction.",
              },
            ].map(({ Icon, title, text }) => (
              <div key={title}>
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto max-w-6xl scroll-mt-16 px-6 py-20"
        >
          <h2 className="text-3xl font-semibold tracking-tight">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Four steps, all in your CI. The statistics are conservative on
            purpose: a green gate means something.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              {
                n: 1,
                title: "Describe real tasks",
                text: "toolgrade init reads your server's tools and scaffolds a suite. You write the prompts a real user would send.",
              },
              {
                n: 2,
                title: "Run two arms",
                text: "Each task runs with your tools and with none, several times, each against a fresh server process.",
              },
              {
                n: 3,
                title: "Grade outcomes",
                text: "Assertions check the answer and the server's actual state afterwards - not what the agent claims it did.",
              },
              {
                n: 4,
                title: "Gate the merge",
                text: "Pass rate, lift over baseline and a regression check set the CI exit code, and every run lands here.",
              },
            ].map((s) => (
              <li key={s.n} className="rounded-xl border p-5">
                <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                  {s.n}
                </div>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl scroll-mt-16 px-6 py-20">
            <h2 className="text-3xl font-semibold tracking-tight">
              Evidence, not demos
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  Icon: ChartLine,
                  title: "Lift with confidence intervals",
                  text: "Wilson intervals on pass rates and a Newcombe interval on lift, with tasks - not trials - as the sample size.",
                },
                {
                  Icon: ShieldCheck,
                  title: "State assertions",
                  text: "Query your server after the run. An agent that says it deleted the note but did not, fails.",
                },
                {
                  Icon: GitCompareArrows,
                  title: "Regression compare",
                  text: "Any two runs, matched task by task, Bonferroni-corrected so a 50-task suite does not cry wolf.",
                },
                {
                  Icon: Workflow,
                  title: "Trajectory viewer",
                  text: "Every trial's tool calls, arguments, results and the assertion that failed - debug in seconds.",
                },
                {
                  Icon: Coins,
                  title: "Cost per run",
                  text: "Tokens and dollars per arm and per trial, plus how many schema tokens your tools add to every request.",
                },
                {
                  Icon: BadgeCheck,
                  title: "Any model",
                  text: "Claude, any OpenAI-compatible API, or a local model through Ollama - so you can grade before you pay.",
                },
              ].map(({ Icon, title, text }) => (
                <div key={title} className="flex gap-3">
                  <Icon
                    className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="get-started"
          className="mx-auto grid max-w-6xl scroll-mt-16 gap-10 px-6 py-20 lg:grid-cols-2"
        >
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              Two minutes to a first grade
            </h2>
            <p className="mt-3 text-muted-foreground">
              Point ToolGrade at the command that starts your server. It lists
              and lints your tools, writes a starter suite, and refuses to run
              until every placeholder prompt is a real one.
            </p>
            <ul className="mt-6 space-y-2 text-sm">
              {[
                "No infrastructure: fresh stdio server per trial",
                "Your model key never reaches the server under test",
                "Exit code 1 on a failed gate or a significant regression",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CircleCheck
                    className="size-4 text-status-good"
                    aria-hidden
                  />{" "}
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <CodeBlock
            label="terminal"
            code={`npx toolgrade init -o evals/suite.yaml -- node dist/server.js
# write real prompts, then:
npx toolgrade run evals/suite.yaml --trials 3

# no API key? grade with a local model
npx toolgrade run evals/suite.yaml --provider openai --model qwen3:8b`}
          />
        </section>

        <section id="pricing" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl scroll-mt-16 px-6 py-20">
            <h2 className="text-3xl font-semibold tracking-tight">Pricing</h2>
            <p className="mt-2 text-muted-foreground">
              Indicative pricing for the pilot programme.
            </p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  name: "Open source",
                  price: "Free",
                  text: "The CLI and GitHub Action. Local reports, your own API keys.",
                  items: [
                    "Unlimited local runs",
                    "CI gate and Markdown PR summary",
                    "Any model provider",
                  ],
                },
                {
                  name: "Team",
                  price: "$49",
                  per: "per project / month",
                  text: "The hosted platform for teams shipping MCP servers.",
                  items: [
                    "Run history and trend charts",
                    "Trajectory viewer and regression compare",
                    "Model-drift alerts",
                    "Unlimited members",
                  ],
                  featured: true,
                },
                {
                  name: "Enterprise",
                  price: "Custom",
                  text: "For platforms with many tool surfaces.",
                  items: [
                    "SSO and audit log",
                    "VPC runners",
                    "Shared task libraries across teams",
                  ],
                },
              ].map((p) => (
                <div
                  key={p.name}
                  className={`rounded-xl border bg-background p-6 ${p.featured ? "ring-2 ring-foreground" : ""}`}
                >
                  <div className="text-sm font-medium text-muted-foreground">
                    {p.name}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold">{p.price}</span>
                    {p.per && (
                      <span className="text-sm text-muted-foreground">
                        {p.per}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{p.text}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {p.items.map((i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CircleCheck
                          className="size-4 text-status-good"
                          aria-hidden
                        />{" "}
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
          <Logo />
          <span>Built for teams who ship MCP servers.</span>
        </div>
      </footer>
    </div>
  );
}

function HeroResult() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">notes-server - real run</div>
          <div className="font-mono text-xs text-muted-foreground">
            {REAL_RUN.model} via Ollama, 6 tasks x 2 arms x 3 trials
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-status-critical/30 bg-status-critical/10 px-2 py-0.5 text-xs font-medium">
          <CircleAlert className="size-3.5 text-status-critical" aria-hidden />{" "}
          Gate failed
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">With tools</dt>
          <dd className="text-2xl font-semibold">
            {Math.round(REAL_RUN.passRate * 100)}%
          </dd>
          <dd className="text-xs text-muted-foreground">
            CI {REAL_RUN.passCi}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">No tools</dt>
          <dd className="text-2xl font-semibold">
            {Math.round(REAL_RUN.baseline * 100)}%
          </dd>
          <dd className="text-xs text-muted-foreground">baseline</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Lift</dt>
          <dd className="text-2xl font-semibold">{REAL_RUN.lift}</dd>
          <dd className="text-xs text-muted-foreground">
            CI {REAL_RUN.liftCi}
          </dd>
        </div>
      </dl>
      <div className="mt-5 space-y-2.5">
        {REAL_RUN.tasks.map((t) => (
          <div
            key={t.id}
            className="grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3 text-xs"
          >
            <span className="truncate font-mono text-muted-foreground">
              {t.id}
            </span>
            <Dumbbell tools={t.tools} baseline={t.baseline} />
            <span className="text-right tabular-nums">
              {Math.round(t.tools * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <DumbbellLegend />
        <span className="text-xs text-muted-foreground">
          78% &lt; 80% required
        </span>
      </div>
    </div>
  );
}
