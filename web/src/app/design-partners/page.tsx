import { Check } from "lucide-react";
import { DesignPartnerForm } from "@/components/design-partner-form";
import { MarketingNav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/sections";

export const metadata = {
  title: "Design Partners",
  description:
    "Work directly with us to put real eval coverage on your MCP server - in exchange for the feedback that shapes what we build next.",
};

const GIVE = [
  "We write your first suite with you, not just docs to follow alone",
  "Direct access to whoever is building the thing, not a support queue",
  "Free hosted access for the length of the program",
];

const ASK = [
  "An MCP server with real users, not a toy project",
  "Time for a short call every couple of weeks",
  "Permission to use your results as a case study (anonymized, if you'd rather)",
];

export default function DesignPartnersPage() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <MarketingNav />
      <main className="mx-auto max-w-4xl px-6 py-24">
        <div className="text-sm font-medium text-chart-1">
          Design partner program
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Help us build the eval platform MCP teams actually need.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          We're looking for a handful of teams shipping a real MCP server to
          work with directly, before the product is finished. In exchange for
          your time and feedback, we put in the work to get your server under
          real eval coverage.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div>
            <div className="text-sm font-medium">What you get</div>
            <ul className="mt-3 space-y-2.5 text-sm">
              {GIVE.map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-chart-1"
                    aria-hidden
                  />
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-sm font-medium">What we're asking for</div>
            <ul className="mt-3 space-y-2.5 text-sm">
              {ASK.map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-chart-1"
                    aria-hidden
                  />
                  {i}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-14 max-w-xl">
          <DesignPartnerForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
