import { Bento } from "@/components/marketing/bento";
import { Hero } from "@/components/marketing/hero";
import { MarketingNav } from "@/components/marketing/nav";
import { Pillars } from "@/components/marketing/pillars";
import { MotionProvider } from "@/components/marketing/primitives";
import {
  Faq,
  FinalCta,
  Footer,
  HowItWorks,
  Measured,
  Methodology,
  Pricing,
  WorksWith,
} from "@/components/marketing/sections";

export default function Landing() {
  return (
    <MotionProvider>
      <div className="min-h-screen overflow-x-clip">
        <MarketingNav />
        <main>
          <Hero />
          <Pillars />
          <Bento />
          <HowItWorks />
          <Measured />
          <WorksWith />
          <Methodology />
          <Pricing />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </MotionProvider>
  );
}
