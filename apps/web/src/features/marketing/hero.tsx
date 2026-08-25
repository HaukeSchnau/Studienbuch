import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { Underlined } from "#/domain-ui/brand/underline.tsx";
import { AppIcon } from "#/domain-ui/brand/wordmark.tsx";
import { Container } from "#/ui/section.tsx";

import { EdgeBlob } from "#/domain-ui/brand/blobs.tsx";

/**
 * The legacy site's composition: the mark and a big green headline, one oversized device render
 * running off the right edge, all on white. The page's confidence comes from the screenshot being
 * allowed to be huge and from the space around the type — not from a coloured band.
 *
 * The greeting and the underline are the two additions. "Moin!" is how the app opens every day, so
 * the site opens the same way; the underline is the swoosh reduced to a single stroke, which lets
 * the headline carry the brand without a band behind it.
 *
 * The explicit row/column placement reproduces the legacy grid areas, including the detail that
 * makes them work: the headline sits at the bottom of its row and the download prompt at the top of
 * the next, so the two converge instead of drifting apart across the height of the render.
 */
export const Hero = () => (
  <section className="relative isolate overflow-x-clip">
    <EdgeBlob
      blob="boulder"
      className="-left-32 top-[22%] size-[17rem] sm:-left-48 sm:size-[36rem]"
      rotate={-12}
      tone="green"
    />
    <EdgeBlob
      blob="bean"
      className="-right-28 top-2 size-[19rem] sm:-right-52 sm:size-[40rem]"
      rotate={24}
      tone="blue"
    />

    <Container
      className="grid items-center gap-y-12 pt-12 pb-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-x-12 lg:pt-16 lg:pb-20"
      width="wide"
    >
      <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
        <div className="flex items-center gap-5 sm:gap-8">
          <AppIcon size="lg" />
          <div>
            <p className="text-xl font-bold text-primary sm:text-2xl">Moin!</p>
            <h1 className="mt-1 text-4xl/[1.35] text-primary-text sm:text-5xl/[1.35] lg:text-6xl/[1.35]">
              Das digitale
              <br />
              <Underlined>Studienbuch</Underlined>
            </h1>
          </div>
        </div>

        <p className="mt-8 max-w-lg text-lg/relaxed text-ink text-pretty sm:text-xl/relaxed">
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
