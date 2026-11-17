// Where marketing calls-to-action point. The server build links into the app; the static
// GitHub Pages build has no app behind it, so it links to a hosted app when NEXT_PUBLIC_APP_URL
// is set, and otherwise to the open-source repository's quick start.

export const REPO_URL = "https://github.com/sifisatz/toolgrade";

const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");

type Link = { label: string; href: string };

function app(path: string): string {
  return STATIC_SITE ? `${APP_URL}${path}` : path;
}

const hasApp = !STATIC_SITE || APP_URL !== "";

export const CTA: {
  primary: Link;
  demo: Link;
  signIn: Link;
  enterprise: Link;
  designPartners: Link;
} = hasApp
  ? {
      primary: { label: "Start free", href: app("/sign-up") },
      demo: { label: "Explore the demo", href: app("/sign-in") },
      signIn: { label: "Sign in", href: app("/sign-in") },
      // No sales team or contact inbox yet - GitHub issues is the one contact channel that
      // actually reaches someone, same as the static (no-app) build below. Not self-serve
      // signup: an "Enterprise" visitor asking a question should not land on a plan picker.
      enterprise: { label: "Talk to us", href: `${REPO_URL}/issues` },
      // /design-partners needs a live database (the application form writes to it), so unlike
      // every other route here it has no .marketing.tsx twin - it only exists in the hosted app.
      designPartners: {
        label: "Design partners",
        href: app("/design-partners"),
      },
    }
  : {
      primary: { label: "Get started", href: `${REPO_URL}#quick-start` },
      demo: {
        label: "Run the demo locally",
        href: `${REPO_URL}/tree/main/web#run-it-locally`,
      },
      signIn: { label: "GitHub", href: REPO_URL },
      enterprise: { label: "Open an issue", href: `${REPO_URL}/issues` },
      // No hosted app to send a static-site visitor to - same GitHub issues fallback as enterprise.
      designPartners: { label: "Design partners", href: `${REPO_URL}/issues` },
    };
