import { subjectSamples } from "#/domain-ui/brand/subjects.ts";

const SubjectTile = ({ color, icon, label }: (typeof subjectSamples)[number]) => (
  <div
    className="mr-4 flex shrink-0 items-center gap-3 rounded-2xl px-5 py-3.5 text-white shadow-card"
    style={{ backgroundColor: color }}
  >
    <img alt="" className="size-7 shrink-0" height={28} src={`/subjects/${icon}.svg`} width={28} />
    <span className="text-lg font-bold whitespace-nowrap">{label}</span>
  </div>
);

/**
 * A timetable that drifts past, built from the app's own illustrated subject icons and the colours
 * the week view actually uses.
 *
 * It is the one purely decorative thing on the page, and it earns its place: it says "school"
 * faster than any sentence, and the tilt keeps it from reading as a logo bar. The row is rendered
 * twice so the translation can loop seamlessly, and the whole thing is hidden from assistive
 * technology. `prefers-reduced-motion` stops it via the global rule in `styles.css`.
 */
export const SubjectStrip = () => (
  <div aria-hidden className="overflow-hidden bg-surface py-10">
    <div className="-mx-[6%] w-[112%] -rotate-[1.5deg]">
      <div className="flex w-max animate-subject-drift">
        {[0, 1].map((copy) =>
          subjectSamples.map((subject) => (
            <SubjectTile key={`${copy}-${subject.label}`} {...subject} />
          )),
        )}
      </div>
    </div>
  </div>
);
