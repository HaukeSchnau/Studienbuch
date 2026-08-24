import { ArrowRight, FileInput, KeyRound, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { externalLinks, sectionIds } from "#/domain-ui/brand/links.ts";
import { Button } from "#/ui/button.tsx";
import { Container, Section, SectionHeading } from "#/ui/section.tsx";

const points: ReadonlyArray<{ body: string; icon: LucideIcon; title: string }> = [
  {
    icon: FileInput,
    title: "Import statt Doppelpflege",
    body: "Klassen, Kurse, Stundenpläne und Vertretungen werden aus dem Stundenplan-System der Schule übernommen, etwa WebUntis. Niemand tippt einen Plan zweimal ab.",
  },
  {
    icon: KeyRound,
    title: "Zugang über die Schule",
    body: "Schülerinnen und Schüler richten die App mit einem Lizenzschlüssel der Schule ein. Wer dazugehört, entscheidet die Schule — nicht eine offene Registrierung.",
  },
  {
    icon: ShieldCheck,
    title: "Datensparsam gebaut",
    body: "Schuldaten liegen auf dem Gerät und auf dem Server der Schule, nicht bei Werbenetzwerken. Es ist bewusst kein Analyse-SDK verbaut.",
  },
];

export const ForSchools = () => (
  <Section id={sectionIds.schools}>
    <Container className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start lg:gap-20">
      <div className="flex flex-col gap-8">
        <SectionHeading
          eyebrow="Für Schulen"
          lead="Studienbuch ersetzt das Papier-Studienbuch für eine ganze Schule. Die Einführung beginnt mit einem Gespräch, nicht mit einem Vertrag."
          title="Studienbuch an deine Schule holen"
        />
        <div className="flex flex-wrap gap-3">
          <Button asChild radius="pill" size="xl" variant="brand">
            <a href={externalLinks.schoolContact}>
              Gespräch anfragen
              <ArrowRight aria-hidden />
            </a>
          </Button>
        </div>
      </div>

      <ul className="flex flex-col gap-8">
        {points.map(({ body, icon: Icon, title }) => (
          <li className="flex gap-5" key={title}>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-des text-accent">
              <Icon aria-hidden className="size-6" strokeWidth={2.25} />
            </span>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl text-primary-text">{title}</h3>
              <p className="text-ink-soft text-pretty">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </Container>
  </Section>
);
