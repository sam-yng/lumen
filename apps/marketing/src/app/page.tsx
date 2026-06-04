import { AppMock } from "@/components/app-mock";
import { FeatureGrid } from "@/components/feature-grid";
import { FinalCta } from "@/components/final-cta";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TrustStrip } from "@/components/trust-strip";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <AppMock />
        <HowItWorks />
        <FeatureGrid />
        <TrustStrip />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
