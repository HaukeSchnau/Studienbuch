import { useAtom } from "@effect/atom-react";

import { Site } from "#/domain-ui/Site.ts";
import { StoreBadges } from "#/domain-ui/StoreBadges.tsx";
import { Blob } from "#/ui/Blob.tsx";
import { PointerTracker } from "#/ui/PointerTracker.tsx";

import { Demo } from "./Demo.ts";
import { PhoneFrame } from "./PhoneFrame.tsx";
import { WeekScreen } from "./Screens.tsx";

/**
 * The closing call to action: a deeply rounded green panel with the week rising out of its bottom
 * edge, cropped by the panel, so the phone sits in the panel rather than on it. White on the brand
 * green is 3.24:1, so nothing on the panel is under 20 px or dimmed.
 */
export function GetTheApp() {
  const [week, setWeek] = useAtom(Demo.shownWeek);

  return (
    <section className="section section-surface get-app" id={Site.sections.app}>
      <Blob
        className="get-app-blob"
        duration={27}
        offset={0.45}
        rotate={-26}
        outline="pinch"
        tone="blue"
      />
      <div className="container">
        <PointerTracker className="get-app-panel reveal pointer-spot">
          <div className="get-app-text">
            <h2>Bis gleich in der App</h2>
            <p>
              Kostenlos für iPhone und Android, und direkt im Browser. Zum Einrichten brauchst du
              den Zugangscode deiner Schule.
            </p>
            <StoreBadges tone="hero" />
          </div>
          <PhoneFrame
            className="phone-week"
            label="Meine Woche: der Stundenplan der Woche mit der Vertretung und dem Entfall von heute."
            tab="week"
          >
            <WeekScreen
              onStep={(step) =>
                setWeek((current) => Math.min(Math.max(current + step, 0), Demo.weeks.length - 1))
              }
              week={week}
            />
          </PhoneFrame>
        </PointerTracker>
      </div>
    </section>
  );
}
