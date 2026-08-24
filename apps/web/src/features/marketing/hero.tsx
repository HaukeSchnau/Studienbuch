import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { Container } from "#/ui/section.tsx";

/**
 * The legacy site's composition, kept: app icon and a big green headline on the left, one oversized
 * device render running off the right edge, all on white. The page's confidence comes from the
 * screenshot being allowed to be huge and from the space around the type — not from a coloured band.
 */
export const Hero = () => (
  <section className="overflow-x-clip bg-surface">
    <Container
      className="grid items-center gap-14 pt-14 pb-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-10 lg:pt-20 lg:pb-24"
      width="wide"
    >
      <div className="flex flex-col">
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

        <p className="mt-10 text-xl text-ink sm:text-2xl">
          Jetzt als Download für Android und iOS:
        </p>
        <StoreBadges className="mt-5" />
      </div>

      {/* Runs off the right edge the way the legacy render did, and stays oversized rather than
          being politely fitted into its column. */}
      <div className="lg:-mr-[14vw] xl:-mr-[10vw]">
        <img
          alt="Die Übersicht mit dem Tagesplan und die Kursseite mit den Noten, nebeneinander."
          className="w-full max-w-xl lg:max-w-none"
          height={1469}
          src="/screenshots/showcase.png"
          width={1282}
        />
      </div>
    </Container>
  </section>
);
