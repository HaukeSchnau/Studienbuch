import { sectionIds } from "#/domain-ui/brand/links.ts";
import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { SwooshPanel } from "#/domain-ui/brand/swoosh.tsx";
import { Container } from "#/ui/section.tsx";

/**
 * Closes the page on the same green the hero opened with. The store listings still carry the name
 * of the school the app launched at, which is why the note below the badges exists.
 */
export const GetTheApp = () => (
  <section className="isolate" id={sectionIds.app}>
    <SwooshPanel>
      <Container className="flex flex-col items-center gap-8 pt-20 pb-28 text-center sm:pt-28 sm:pb-40">
        <h2 className="max-w-2xl text-3xl text-white text-balance sm:text-5xl">
          Hol dir dein Studienbuch
        </h2>
        {/* See the note in `hero.tsx`: white on the brand green only passes AA as large text, so
            nothing on this band is dimmed and the lead stays at 20px or more. */}
        <p className="max-w-xl text-xl/relaxed text-white text-pretty">
          Kostenlos für Android und iOS. Zum Einrichten brauchst du den Lizenzschlüssel deiner
          Schule.
        </p>
        <StoreBadges className="justify-center" />
        <p className="max-w-md text-sm text-white">
          Die App erscheint in den Stores derzeit noch unter dem Namen der Schule, an der sie
          gestartet ist.
        </p>
      </Container>
    </SwooshPanel>
  </section>
);
