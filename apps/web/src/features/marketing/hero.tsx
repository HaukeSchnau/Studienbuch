import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { Container } from "#/ui/section.tsx";

/**
 * The legacy site's composition, kept: app icon and a big green headline, one oversized device
 * render running off the right edge, all on white. The page's confidence comes from the screenshot
 * being allowed to be huge and from the space around the type — not from a coloured band.
 *
 * The explicit row/column placement reproduces the legacy grid areas, so the render sits between
 * the headline and the download prompt when the columns collapse, rather than below both.
 */
export const Hero = () => (
  <section className="overflow-x-clip bg-surface">
    <Container
      className="grid items-center gap-y-12 pt-12 pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-12 lg:pt-16 lg:pb-20"
      width="wide"
    >
      <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
        <div className="flex items-center gap-5 sm:gap-8">
          <img
            alt=""
            className="aspect-square w-24 shrink-0 rounded-[1.5rem] shadow-card-lg sm:w-32 sm:rounded-[2rem] lg:w-40"
            height={512}
            src="/brand/icon-512.png"
            width={512}
          />
          <h1 className="text-4xl/[1.35] text-primary-text sm:text-5xl/[1.35] lg:text-6xl/[1.35]">
            Das digitale
            <br />
            Studienbuch
          </h1>
        </div>

        <p className="mt-8 max-w-lg text-lg/relaxed text-ink-soft text-pretty sm:text-xl/relaxed">
          Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben — an einem Ort, in der
          Hosentasche, auch ohne Empfang.
        </p>
      </div>

      {/* The negative margin sets how much bigger than its column the render gets to be; the
          translate then pushes it past the viewport edge without resizing it again. */}
      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:-mr-[8vw] lg:translate-x-[5vw]">
        <img
          alt="Die Übersicht mit dem Tagesplan und die Kursseite mit den Noten, nebeneinander."
          className="w-full"
          height={1469}
          src="/screenshots/showcase.png"
          width={1282}
        />
      </div>

      <div className="lg:col-start-1 lg:row-start-2 lg:self-start">
        <p className="text-xl text-ink sm:text-2xl">Jetzt als Download für Android und iOS:</p>
        <StoreBadges className="mt-5" />
      </div>
    </Container>
  </section>
);
