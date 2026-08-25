import { sectionIds } from "#/domain-ui/brand/links.ts";
import { StoreBadges } from "#/domain-ui/brand/store-badges.tsx";
import { Container, Section } from "#/ui/section.tsx";

import { EdgeBlob } from "./decor.tsx";

/**
 * The closing call to action: a deeply rounded green panel with a phone rising out of its bottom
 * edge, cropped by the panel itself. The crop is the point — the device reads as sitting inside the
 * panel rather than pasted onto it, and it gives the section something to look at besides two
 * centred paragraphs.
 *
 * It used to end in the app's swoosh. That shape is drawn for a 390pt phone header, and stretching
 * it across a desktop flattens a confident sweep into a slack line. The gesture survives on the
 * page where it still reads, as the stroke under the headline.
 *
 * Nothing here is dimmed or under 20px. White on the brand green is 3.2:1, which clears WCAG AA as
 * large text and nothing smaller.
 */
export const GetTheApp = () => (
  <Section className="relative isolate" id={sectionIds.app}>
    <EdgeBlob
      className="top-6 hidden h-[26rem] w-[10rem] xl:block"
      flip
      silhouette="lobe"
      side="right"
      tone="blue"
    />

    <Container>
      <div className="relative overflow-hidden rounded-[2.5rem] bg-primary px-6 pt-14 pb-14 sm:rounded-[3.5rem] sm:px-12 sm:pt-20 sm:pb-20 lg:pb-0">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
          <div className="flex flex-col items-center gap-7 text-center lg:items-start lg:pb-20 lg:text-left">
            <h2 className="max-w-xl text-3xl/snug text-white text-balance sm:text-5xl/snug">
              Bis gleich in der App
            </h2>
            <p className="max-w-md text-xl/relaxed text-white text-pretty">
              Kostenlos für Android und iOS. Zum Einrichten brauchst du den Lizenzschlüssel deiner
              Schule.
            </p>
            <StoreBadges />
          </div>

          {/* Hidden below `lg`: there is no room for the device to be cropped by the panel rather
              than merely cut off, and a squeezed phone reads as a mistake. */}
          <div className="hidden lg:block lg:self-end">
            {/* Narrow enough to clear the panel's side, and pulled down far enough that the bottom
                edge cuts it deliberately rather than grazing it. */}
            <div className="mx-auto -mb-28 w-64 translate-y-6 rotate-[5deg]">
              <div className="overflow-hidden rounded-[2.25rem] bg-black p-1.5 shadow-card-lg">
                <img
                  alt="Die Übersicht mit dem Tagesplan und den offenen Fehlzeiten."
                  className="block w-full rounded-[1.85rem]"
                  height={696}
                  src="/screenshots/overview.png"
                  width={392}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  </Section>
);
