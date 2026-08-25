import { useEffect, useRef } from "react";

import { subjectSamples } from "#/domain-ui/brand/subjects.ts";
import { useMotionAllowed } from "#/ui/use-motion.ts";

const SubjectTile = ({ color, icon, label }: (typeof subjectSamples)[number]) => (
  <div
    className="mr-4 flex shrink-0 items-center gap-3 rounded-2xl px-5 py-3.5 text-white shadow-card transition-transform duration-200 hover:-translate-y-1"
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
/**
 * How much faster the row runs at full scroll speed. Beyond roughly four times it stops reading as
 * responsiveness and starts reading as a glitch.
 */
const maximumBoost = 3.5;

export const SubjectStrip = () => {
  const track = useRef<HTMLDivElement>(null);
  const motionAllowed = useMotionAllowed();

  /**
   * The row speeds up while the page is being scrolled and eases back when it stops.
   *
   * Scroll velocity is read from the scroll position rather than from wheel events, so it works for
   * a trackpad, a dragged scrollbar and keyboard paging alike. `playbackRate` is used instead of
   * restarting the animation because it changes speed without a jump — the row never loses its
   * place, which is the whole reason the seamless loop was built.
   */
  useEffect(() => {
    const element = track.current;
    if (element === null || !motionAllowed) {
      return;
    }
    const animation = element.getAnimations()[0];
    if (animation === undefined) {
      return;
    }

    let lastY = globalThis.scrollY;
    let boost = 1;
    let frame = globalThis.requestAnimationFrame(function tick() {
      const y = globalThis.scrollY;
      const velocity = Math.abs(y - lastY);
      lastY = y;

      const target = Math.min(1 + velocity / 18, maximumBoost);
      // Rises quickly with the scroll and falls back slowly, so stopping coasts rather than brakes.
      boost += (target - boost) * (target > boost ? 0.35 : 0.06);
      animation.playbackRate = boost;

      frame = globalThis.requestAnimationFrame(tick);
    });

    return () => {
      globalThis.cancelAnimationFrame(frame);
      animation.playbackRate = 1;
    };
  }, [motionAllowed]);

  return (
    // Reaching for a tile stops the row. Chasing a moving target is irritating; stopping for the
    // pointer turns the strip from decoration into something you can actually look at.
    <div aria-hidden className="group overflow-hidden bg-surface py-10">
      <div className="-mx-[6%] w-[112%] -rotate-[1.5deg]">
        <div
          className="flex w-max animate-subject-drift group-hover:[animation-play-state:paused]"
          ref={track}
        >
          {[0, 1].map((copy) =>
            subjectSamples.map((subject) => (
              <SubjectTile key={`${copy}-${subject.label}`} {...subject} />
            )),
          )}
        </div>
      </div>
    </div>
  );
};
