import { StoreBadges } from "#/domain-ui/StoreBadges.tsx";
import { AppIcon } from "#/domain-ui/Wordmark.tsx";
import { Blob } from "#/ui/Blob.tsx";
import { PointerTracker } from "#/ui/PointerTracker.tsx";
import { Underlined } from "#/ui/Underline.tsx";

import { Demo } from "./Demo.ts";
import { PhoneFrame } from "./PhoneFrame.tsx";
import { CourseScreen, TodayScreen } from "./Screens.tsx";

/**
 * The August composition: the notebook and headline on the left, and two phones of different sizes
 * tilted apart. Each phone works on its own: a lesson opens its course inside the Übersicht phone,
 * and the course phone signs inside itself. Neither overlaps the other's controls.
 */
export function Hero({ demo, dispatch }: { demo: Demo.State; dispatch: Demo.Dispatch }) {
  const screen = demo.todayScreen;

  const open = (id: string) => {
    if (Demo.isCourse(id)) dispatch({ kind: "open", course: id });
  };

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
            Stundenplan, Vertretungen, Noten, Fehlzeiten und Hausaufgaben an einem Ort, in der
            Hosentasche und auch ohne Empfang. Noten, Fehlzeiten und Hausaufgaben verschlüsselt dein
            Handy, bevor sie es verlassen.
          </p>
        </div>

        <PointerTracker className="hero-phones">
          <div className="hero-scene" data-screen={screen === "today" ? "today" : "course"}>
            <PhoneFrame
              className="phone-today"
              label={
                screen === "today"
                  ? "Die Übersicht der App: der heutige Tag mit Vertretung und Entfall, darunter die Fehlzeiten."
                  : `Die Kursseite ${Demo.courses[screen].name}, aus der Übersicht geöffnet.`
              }
              tab="today"
            >
              {screen === "today" ? (
                <TodayScreen onOpen={open} />
              ) : (
                <CourseScreen
                  course={screen}
                  exams={Demo.signedExams(screen, demo.signed.today)}
                  onBack={() => dispatch({ kind: "back" })}
                  onSign={(exam) => dispatch({ kind: "sign", place: "today", exam })}
                />
              )}
            </PhoneFrame>
            <PhoneFrame
              className="phone-course"
              label="Die Kursseite Deutsch mit den Noten."
              tab="today"
            >
              <CourseScreen
                course="de"
                exams={Demo.signedExams("de", demo.signed.grades)}
                onSign={(exam) => dispatch({ kind: "sign", place: "grades", exam })}
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
