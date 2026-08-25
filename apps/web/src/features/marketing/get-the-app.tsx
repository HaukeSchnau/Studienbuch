import { sectionIds } from "#/domain-ui/brand/links.ts";
import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { Container, Section } from "#/ui/section.tsx";

/**
 * The closing call to action, as a deeply rounded green panel rather than a full-bleed band.
 *
 * It used to end in the app's swoosh. That shape is drawn for a 390pt phone header, and stretching
 * it across a desktop turns a confident sweep into a slack line — the curve loses all of its
 * character at that aspect ratio. The gesture survives on the page where it still reads: as the
 * stroke under the headline.
 *
 * Nothing here is dimmed or under 20px. White on the brand green is 3.2:1, which clears WCAG AA as
 * large text and nothing smaller.
 */
export const GetTheApp = () => (
  <Section id={sectionIds.app}>
    <Container>
      <div className="flex flex-col items-center gap-7 rounded-[2.5rem] bg-primary px-6 py-16 text-center sm:rounded-[3.5rem] sm:px-12 sm:py-20">
        <h2 className="max-w-2xl text-3xl/snug text-white text-balance sm:text-5xl/snug">
          Bis gleich in der App
        </h2>
        <p className="max-w-xl text-xl/relaxed text-white text-pretty">
          Kostenlos für Android und iOS. Zum Einrichten brauchst du den Lizenzschlüssel deiner
          Schule.
        </p>
        <StoreBadges className="justify-center" />
      </div>
    </Container>
  </Section>
);
