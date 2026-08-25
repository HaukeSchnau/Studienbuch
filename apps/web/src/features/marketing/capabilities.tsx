import type { ReactNode } from "react";

import { sectionIds } from "#/domain-ui/brand/links.ts";
import { cn } from "#/ui/cn.ts";
import { Container, Section, SectionHeading } from "#/ui/section.tsx";

import { EdgeBlob } from "#/domain-ui/brand/blobs.tsx";

import {
  AbsencePreview,
  GradePreview,
  OfflinePreview,
  SchedulePreview,
  TaskPreview,
} from "./app-previews.tsx";

/**
 * Each card is tinted with one of the app's desaturated state colours and carries a small rebuild
 * of the surface it describes, so the section shows the product rather than illustrating it with
 * stock icons.
 */
const capabilities: ReadonlyArray<{
  body: string;
  preview: ReactNode;
  tint: string;
  title: string;
}> = [
  {
    title: "Stundenplan & Vertretungen",
    body: "Der Wochenplan kommt aus dem Stundenplan-System der Schule. Was heute ausfällt, verlegt oder vertreten wird, steht morgens in der Übersicht — mit Grund und Lehrkraft.",
    preview: <SchedulePreview />,
    tint: "bg-accent-des",
  },
  {
    title: "Noten",
    body: "Mündlich und schriftlich getrennt, in Punkten, mit Stand und Durchschnitt. Einzelne Ergebnisse werden von Lehrkraft und Eltern per Unterschrift bestätigt.",
    preview: <GradePreview />,
    tint: "bg-primary-des",
  },
  {
    title: "Fehlzeiten",
    body: "Fehltage eintragen, Grund hinterlegen und sehen, welche Entschuldigung noch aussteht — statt loser Zettel und Stempel im Papierheft.",
    preview: <AbsencePreview />,
    tint: "bg-alert-des",
  },
  {
    title: "Hausaufgaben",
    body: "Aufgaben hängen am Kurs, haben ein Fälligkeitsdatum und dürfen auch einfach ein Foto vom Tafelbild sein.",
    preview: <TaskPreview />,
    tint: "bg-danger-des",
  },
];

export const Capabilities = () => (
  <Section className="relative isolate" id={sectionIds.capabilities} tone="background">
    {/* Hidden below xl: the content column runs close to the edge on narrower viewports and a
        blob would sit behind body text instead of in the margin. */}
    <EdgeBlob
      blob="kidney"
      duration={24}
      offset={0.6}
      className="-right-52 top-36 hidden size-[24rem] min-[1440px]:block"
      rotate={-18}
      tone="green"
    />

    <Container className="flex flex-col gap-12">
      <SectionHeading
        lead="Das Papier-Studienbuch kann eine Sache sehr gut: alles an einem Ort sammeln. Genau das macht die App — nur dass sie mitdenkt."
        title="Der Schulalltag, auf einem Blick"
      />

      <ul className="stagger grid gap-6 sm:grid-cols-2">
        {capabilities.map(({ body, preview, tint, title }) => (
          <li key={title}>
            <article
              className={cn(
                "reveal weight-hover flex h-full flex-col gap-6 rounded-card-lg p-8 transition-transform duration-300 hover:-translate-y-1",
                tint,
              )}
            >
              <div className="grid min-h-32 place-items-center">
                <div className="w-full max-w-xs">{preview}</div>
              </div>
              <div className="flex flex-col gap-3">
                <h3 className="text-2xl text-primary-text">{title}</h3>
                <p className="text-lg/relaxed text-ink-soft text-pretty">{body}</p>
              </div>
            </article>
          </li>
        ))}

        {/* Offline is the one thing paper and most school apps cannot do, so it takes the full
            width rather than a band of its own. */}
        <li className="sm:col-span-2">
          <article className="reveal flex flex-col gap-6 rounded-card-lg bg-primary p-8 text-white sm:flex-row sm:items-center sm:gap-10 sm:p-10">
            <div className="flex max-w-xl flex-col gap-3">
              <h3 className="text-2xl text-white sm:text-3xl">Funktioniert auch ohne Empfang</h3>
              {/* 20px minimum: white on the brand green is 3.2:1, which only clears AA as large
                  text. Nothing on a green surface may be smaller or dimmed. */}
              <p className="text-xl/relaxed text-white text-pretty">
                Studienbuch speichert zuerst auf dem Gerät und gleicht ab, sobald wieder Netz da
                ist. Die App öffnet sich mit deinen Daten statt mit einem Ladebalken, und was du im
                Fachraum einträgst, geht nicht verloren.
              </p>
            </div>
            <OfflinePreview />
          </article>
        </li>
      </ul>
    </Container>
  </Section>
);
