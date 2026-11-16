import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </div>
      </div>
      <aside className="hidden flex-col justify-between border-l bg-muted/40 p-12 lg:flex">
        <div className="max-w-md">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            Stop guessing whether a tool change helped. Measure it on every pull
            request.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            ToolGrade grades your MCP server against the same agent with no
            tools, and fails the build when quality drops.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>Lift over a no-tool baseline, with confidence intervals</li>
          <li>Outcome checks against your server's real state</li>
          <li>A CI gate that blocks significant regressions</li>
        </ul>
      </aside>
    </div>
  );
}
