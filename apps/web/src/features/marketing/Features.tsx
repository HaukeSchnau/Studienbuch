import type { ReactNode } from "react";

import { AbsenceCard } from "#/domain-ui/app/AbsenceCard.tsx";
import { AgendaCard } from "#/domain-ui/app/AgendaCard.tsx";
import { GradesCard } from "#/domain-ui/app/GradesCard.tsx";
import { HomeworkCard } from "#/domain-ui/app/HomeworkCard.tsx";
import { Site } from "#/domain-ui/Site.ts";
import { Blob } from "#/ui/Blob.tsx";

import { Demo } from "./Demo.ts";

const changes = Demo.today.filter((row) => row.id !== "ma" && row.id !== "de");

function Feature({
  area,
  title,
  children,
  preview,
}: {
  area: string;
  title: string;
  children: ReactNode;
  preview: ReactNode;
}) {
  return (
    <article className={`feature feature-${area} reveal`}>
      <div className="feature-preview">{preview}</div>
      <div className="feature-text">
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </article>
  );
}

/**
 * What the app does, each card tinted with one of the app's state colours and holding the live
 * component it describes: two small cards side by side, then the grades and the offline card at
 * full width, so no card stretches beside a taller one.
 */
export function Features({ demo, dispatch }: { demo: Demo.State; dispatch: Demo.Dispatch }) {
  const exams = Demo.signedExams("de", demo.signed.features);

  return (
    <section className="section section-canvas features" id={Site.sections.features}>
      <Blob
        className="features-blob"
        duration={24}
        offset={0.6}
        rotate={-18}
        outline="kidney"
        tone="green"
      />
      <div className="container">
        <div className="section-heading">
          <h2>Der Schulalltag auf einen Blick</h2>
          <p>
            Das Papier-Studienbuch kann eine Sache sehr gut: alles an einem Ort sammeln. Genau das
            macht die App, nur dass sie mitdenkt.
          </p>
        </div>

        <div className="feature-grid reveal-group">
          <Feature
            area="timetable"
            preview={<AgendaCard rows={changes} />}
            title="Stundenplan und Vertretungen"
          >
            Der Plan kommt direkt aus dem Stundenplan deiner Schule. Was heute ausfällt oder
            vertreten wird, steht morgens in der Übersicht.
          </Feature>

          <Feature
            area="grades"
            preview={
              <GradesCard
                average={Demo.confirmedAverage(exams)}
                exams={exams}
                oral={Demo.courses.de.oral}
                onSign={(exam) => dispatch({ kind: "sign", place: "features", exam })}
              />
            }
            title="Noten"
          >
            Mündlich und schriftlich getrennt, in Punkten, mit Stand und Schnitt. Lehrkraft und
            Eltern unterschreiben direkt auf dem Handy, und erst dann zählt eine Klausur.
          </Feature>

          <Feature
            area="absences"
            preview={<AbsenceCard days={1} entries={Demo.absences} unexcused={2} />}
            title="Fehlzeiten"
          >
            Fehltage eintragen, Grund dazuschreiben und sehen, welche Entschuldigung noch fehlt.
            Ohne lose Zettel und Stempel im Papierheft.
          </Feature>

          <Offline demo={demo} dispatch={dispatch} />
        </div>
      </div>
    </section>
  );
}

/**
 * Offline is what paper can do and most school apps can't, so it takes the full width, and the
 * visitor can feel it rather than read it: the phone is in a dead spot, so a ticked homework waits
 * on the device and goes out by itself once the signal is back.
 */
function Offline({ demo, dispatch }: { demo: Demo.State; dispatch: Demo.Dispatch }) {
  const toggle = (homework: string) => {
    dispatch({ kind: "tick", homework });
    setTimeout(() => dispatch({ kind: "synced" }), Demo.signalDelays.back);
    setTimeout(
      () => dispatch({ kind: "settled" }),
      Demo.signalDelays.back + Demo.signalDelays.settle,
    );
  };

  const waiting = demo.homework.filter((item) => item.pending).length;
  const synced = demo.signal === "synced";

  return (
    <article className="feature feature-offline reveal">
      <div className="feature-offline-text">
        <h3>Funktioniert auch ohne Empfang</h3>
        <p>
          Studienbuch speichert alles zuerst auf deinem Gerät. Hak im Funkloch eine Aufgabe ab: Sie
          wartet auf dem Handy und geht raus, sobald wieder Netz da ist. Und die App öffnet sich mit
          deinen Daten statt mit einem Ladebalken.
        </p>
      </div>
      <div className="feature-offline-preview">
        <HomeworkCard
          items={demo.homework}
          onToggle={toggle}
          status={
            <span className="signal" data-signal={demo.signal}>
              <svg aria-hidden className="signal-icon" viewBox="0 0 24 24">
                <path
                  d={
                    synced ? "M5 12.5l4.5 4.5L19 7.5" : "M4 18h2M9 18v-4M14 18v-7M19 18V7M3 4l18 16"
                  }
                />
              </svg>
              {synced
                ? "Wieder Netz, abgeglichen"
                : waiting === 0
                  ? "Kein Netz"
                  : `Kein Netz, ${String(waiting)} ${waiting === 1 ? "Änderung wartet" : "Änderungen warten"}`}
            </span>
          }
        />
      </div>
    </article>
  );
}
