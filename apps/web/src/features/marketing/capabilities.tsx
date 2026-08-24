import { CalendarDays, ClipboardCheck, GraduationCap, ListChecks } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { sectionIds } from "#/domain-ui/brand/links.ts";
import { Card, Container, Section, SectionHeading } from "#/ui/section.tsx";

const capabilities: ReadonlyArray<{ body: string; icon: LucideIcon; title: string }> = [
  {
    icon: CalendarDays,
    title: "Stundenplan & Vertretungen",
    body: "Der Wochenplan kommt aus dem Stundenplan-System der Schule. Was heute ausfällt, verlegt oder vertreten wird, steht morgens in der Übersicht — mit Grund und Lehrkraft.",
  },
  {
    icon: GraduationCap,
    title: "Noten",
    body: "Mündlich und schriftlich getrennt, in Punkten, mit Stand und Durchschnitt. Einzelne Ergebnisse werden von Lehrkraft und Eltern per Unterschrift bestätigt.",
  },
  {
    icon: ClipboardCheck,
    title: "Fehlzeiten",
    body: "Fehltage eintragen, Grund hinterlegen und sehen, welche Entschuldigung noch aussteht — statt loser Zettel und Stempel im Papierheft.",
  },
  {
    icon: ListChecks,
    title: "Hausaufgaben",
    body: "Aufgaben hängen am Kurs, haben ein Fälligkeitsdatum und dürfen auch einfach ein Foto vom Tafelbild sein.",
  },
];

export const Capabilities = () => (
  <Section id={sectionIds.capabilities} tone="background">
    <Container className="flex flex-col gap-14">
      <SectionHeading
        align="center"
        eyebrow="Für Schülerinnen und Schüler"
        lead="Das Papier-Studienbuch kann eine Sache sehr gut: alles an einem Ort sammeln. Genau das macht die App — nur dass sie mitdenkt."
        title="Der Schulalltag, auf einem Blick"
      />

      <ul className="grid gap-6 sm:grid-cols-2">
        {capabilities.map(({ body, icon: Icon, title }) => (
          <li key={title}>
            <Card className="flex h-full flex-col gap-4">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-des text-primary-text">
                <Icon aria-hidden className="size-6" strokeWidth={2.25} />
              </span>
              <h3 className="text-xl text-primary-text">{title}</h3>
              <p className="text-ink-soft text-pretty">{body}</p>
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  </Section>
);
