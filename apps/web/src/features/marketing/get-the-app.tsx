import { sectionIds } from "#/domain-ui/brand/links.ts";
import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { SwooshPanel } from "#/domain-ui/brand/swoosh.tsx";
import { Mark } from "#/domain-ui/brand/wordmark.tsx";
import { Container } from "#/ui/section.tsx";

/**
 * The page's only green band, and the only place the swoosh appears at full size — the app's own
 * header signing the site off. Nothing here is dimmed or under 20px: white on the brand green is
 * 3.2:1, which clears WCAG AA as large text and nothing else.
 */
export const GetTheApp = () => (
  <section id={sectionIds.app}>
    <SwooshPanel>
      <Container className="flex flex-col items-center gap-7 pt-20 pb-28 text-center sm:pt-24 sm:pb-36">
        <Mark className="size-16 rounded-[1rem] shadow-float sm:size-20 sm:rounded-[1.25rem]" />
        <h2 className="max-w-2xl text-3xl/snug text-white text-balance sm:text-5xl/snug">
          Bis gleich in der App
        </h2>
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
