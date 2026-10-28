import { useAtom } from "@effect/atom-react";

import { StoreBadges } from "#/domain-ui/StoreBadges.tsx";
import { AppIcon } from "#/domain-ui/Wordmark.tsx";
import { Blob } from "#/ui/Blob.tsx";
import { PointerTracker } from "#/ui/PointerTracker.tsx";
import { Underlined } from "#/ui/Underline.tsx";

import { Demo } from "./Demo.ts";
import { PhoneFrame } from "./PhoneFrame.tsx";
import { CourseScreen, TodayScreen } from "./Screens.tsx";

/**
 * The legacy site's composition: the notebook and a big green headline on the left, the app huge
 * and running off the right edge. Where the legacy page had a screenshot, two live screens stand
 * one behind the other, as the August render did. A lesson tapped in the Übersicht opens its course
 * and brings that phone forward; tapping or focusing the phone behind brings it back.
 *
 * The headline sits at the bottom of its grid row and the download prompt at the top of the next,
 * so the two converge beside the phones instead of drifting apart across their height.
 */
export function Hero() {
  const [course, setCourse] = useAtom(Demo.openCourse);
  const [signed, setSigned] = useAtom(Demo.signatures);
  const [front, setFront] = useAtom(Demo.frontPhone);

  const open = (id: string) => {
    if (!Demo.isCourse(id)) return;
    setCourse(id);
    setFront("course");
  };

  const depth = (phone: typeof front) => (front === phone ? "front" : "back");

  return (
    <section className="hero">
      <Blob className="hero-blob-green" duration={26} outline="legacyGreen" tone="green" />
      <Blob
        className="hero-blob-blue"
        duration={31}
        offset={0.35}
        outline="legacyBlue"
        tone="blue"
      />

      <div className="container container-wide hero-grid">
        <div className="hero-heading">
          <AppIcon size="large" />
          <h1 className="hero-title">
            <span className="enter-heading">Das digitale</span>
            <span className="enter-heading enter-late">
              <Underlined>Studienbuch</Underlined>
            </span>
          </h1>
          <p className="hero-lead enter enter-later">
            Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben an einem Ort. In der
            Hosentasche, auch ohne Empfang, und verschlüsselt, bevor etwas dein Handy verlässt.
          </p>
        </div>

        <PointerTracker className="hero-phones">
          <div className="hero-scene" data-front={front}>
            <PhoneFrame
              className="phone-today"
              depth={depth("today")}
              label="Die Übersicht der App: der heutige Tag mit Vertretung und Entfall, darunter die Fehlzeiten."
              onRaise={() => setFront("today")}
              raiseLabel="Übersicht ansehen"
              tab="today"
            >
              <TodayScreen onOpen={open} />
            </PhoneFrame>
            <PhoneFrame
              className="phone-course"
              depth={depth("course")}
              label={`Die Kursseite ${Demo.courses[course].name} mit den Noten.`}
              onRaise={() => setFront("course")}
              raiseLabel="Noten ansehen"
              tab="today"
            >
              <CourseScreen
                course={course}
                exams={Demo.signedExams(course, signed)}
                onSign={(id) => setSigned((current) => new Set(current).add(id))}
              />
            </PhoneFrame>
            <p aria-hidden className="hero-hint">
              Probier's aus: Tipp auf eine Stunde
              <svg className="hero-hint-arrow" viewBox="0 0 34 46">
                <path d="M30 4C8 10 4 28 14 42M14 42 4 34M14 42 20 30" />
              </svg>
            </p>
          </div>
        </PointerTracker>

        <div className="hero-download enter enter-later">
          <p className="hero-download-prompt">Für iPhone, Android und im Browser:</p>
          <StoreBadges tone="canvas" />
          <p className="hero-proof">Seit 2023 im täglichen Einsatz.</p>
        </div>
      </div>
    </section>
  );
}
