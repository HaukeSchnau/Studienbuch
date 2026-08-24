import { externalLinks, sectionIds } from "#/domain-ui/brand/links.ts";
import { SwooshPanel } from "#/domain-ui/brand/swoosh.tsx";
import { Button } from "#/ui/button.tsx";
import { Container } from "#/ui/section.tsx";

import { PhoneShowcase } from "./phone-showcase.tsx";

/**
 * Green band, white headline, phones riding across the curve — the same composition the app opens
 * with. The top padding clears the fixed pill nav, which floats over this green.
 */
export const Hero = () => (
  <section className="relative">
    <SwooshPanel>
      <Container className="pt-32 pb-28 text-center sm:pt-40 sm:pb-40">
        <h1 className="mx-auto max-w-4xl text-4xl text-white text-balance sm:text-6xl lg:text-7xl">
          Das digitale Studienbuch.
        </h1>
        {/* Full white and at least 20px: white on the brand green is 3.2:1, which only clears
            WCAG AA as large text. Anything smaller or dimmed here would fail. */}
        <p className="mx-auto mt-6 max-w-3xl text-xl/relaxed text-white text-pretty sm:text-2xl/relaxed">
          Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben — an einem Ort, in der
          Hosentasche, auch ohne Empfang.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild radius="pill" size="xl" variant="on-primary">
            <a href={`#${sectionIds.app}`}>App laden</a>
          </Button>
          <Button asChild radius="pill" size="xl" variant="on-primary-secondary">
            <a href={externalLinks.schoolContact}>Für Schulen</a>
          </Button>
        </div>
      </Container>
    </SwooshPanel>

    {/* `relative` is load-bearing: SwooshPanel is positioned, and a positioned box always paints
        above a static sibling regardless of DOM order, so without it the green covers the phones. */}
    <Container className="relative -mt-24 pb-20 sm:-mt-36 sm:pb-28">
      <PhoneShowcase />
    </Container>
  </section>
);
