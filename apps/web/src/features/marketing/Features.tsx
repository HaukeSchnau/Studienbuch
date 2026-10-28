import { useAtom } from "@effect/atom-react";
import type { ReactNode } from "react";

import { AbsenceCard } from "#/domain-ui/app/AbsenceCard.tsx";
import { AgendaCard } from "#/domain-ui/app/AgendaCard.tsx";
import { GradesCard } from "#/domain-ui/app/GradesCard.tsx";
import { HomeworkPanel } from "#/domain-ui/app/HomeworkPanel.tsx";
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
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  );
}

/**
 * What the app does, each card tinted with one of the app's state colours and holding the live
 * component it describes. The cards differ in height, so they sit in a grid of areas rather than
 * in identical rows.
 */
export function Features() {
  const [signed, setSigned] = useAtom(Demo.signatures);
  const exams = Demo.signedExams("de", signed);

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
                onSign={(id) => setSigned((current) => new Set(current).add(id))}
              />
            }
            title="Noten"
          >
            Mündlich und schriftlich getrennt, in Punkten, mit Stand und Schnitt. Lehrkraft und
            Eltern unterschreiben direkt auf dem Handy, und erst dann zählt eine Klausur.
          </Feature>

          <Feature
            area="absences"
            preview={<AbsenceCard days={1} unexcused={2} />}
            title="Fehlzeiten"
          >
            Fehltage eintragen, Grund dazuschreiben und sehen, welche Entschuldigung noch fehlt.
            Ohne lose Zettel und Stempel im Papierheft.
          </Feature>

          <Offline />
        </div>
      </div>
    </section>
  );
}

/**
 * Offline is what paper can do and most school apps can't, so it takes the full width, and the
 * visitor can try it: with the switch on, a ticked homework is saved and waits for the network.
 */
function Offline() {
  const [offline, setOffline] = useAtom(Demo.offline);
  const [homework, setHomework] = useAtom(Demo.ticked);

  const toggle = (id: string) =>
    setHomework((items) =>
      items.map((item) =>
        item.id === id ? { ...item, done: !item.done, pending: offline } : item,
      ),
    );

  const goOnline = (next: boolean) => {
    setOffline(next);

    if (!next) setHomework((items) => items.map((item) => ({ ...item, pending: false })));
  };

  const waiting = homework.filter((item) => item.pending).length;

  return (
    <article className="feature feature-offline reveal">
      <div className="feature-offline-text">
        <h3>Funktioniert auch ohne Empfang</h3>
        <p>
          Studienbuch speichert alles zuerst auf deinem Gerät und gleicht ab, sobald wieder Netz da
          ist. Die App öffnet sich mit deinen Daten statt mit einem Ladebalken, und was du im
          Funkloch abhakst, geht nicht verloren.
        </p>
        <button
          aria-checked={offline}
          className="airplane press"
          onClick={() => goOnline(!offline)}
          role="switch"
          type="button"
        >
          <span aria-hidden className="airplane-track">
            <span className="airplane-thumb" />
          </span>
          Flugmodus
        </button>
        <p aria-live="polite" className="airplane-status">
          {offline
            ? waiting === 0
              ? "Kein Netz. Hak eine Aufgabe ab."
              : `Kein Netz. ${String(waiting)} ${waiting === 1 ? "Änderung wartet" : "Änderungen warten"} auf dem Gerät.`
            : "Online. Alles abgeglichen."}
        </p>
      </div>
      <div className="feature-offline-preview">
        <HomeworkPanel items={homework} onToggle={toggle} />
      </div>
    </article>
  );
}
