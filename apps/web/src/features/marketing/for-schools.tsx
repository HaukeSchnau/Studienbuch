import { ArrowRight } from "lucide-react";

import { externalLinks, sectionIds } from "#/domain-ui/brand/links.ts";
import { Button } from "#/ui/button.tsx";
import { Container, Section, SectionHeading } from "#/ui/section.tsx";

const points: ReadonlyArray<{ body: string; title: string }> = [
  {
    title: "Import statt Doppelpflege",
    body: "Klassen, Kurse, Stundenpläne und Vertretungen kommen aus dem Stundenplan-System der Schule, etwa WebUntis. Niemand tippt einen Plan zweimal ab.",
  },
  {
    title: "Zugang über die Schule",
    body: "Eingerichtet wird mit einem Lizenzschlüssel der Schule. Wer dazugehört, entscheidet die Schule — nicht eine offene Registrierung.",
  },
  {
    title: "Datensparsam gebaut",
    body: "Schuldaten liegen auf dem Gerät und auf dem Server der Schule, nicht bei Werbenetzwerken. Es ist bewusst kein Analyse-SDK verbaut.",
  },
];

export const ForSchools = () => (
  <Section id={sectionIds.schools}>
    <Container className="flex flex-col gap-12">
      <SectionHeading
        lead="Studienbuch ersetzt das Papier-Studienbuch für eine ganze Schule. Die Einführung beginnt mit einem Gespräch, nicht mit einem Vertrag."
        title="Studienbuch an deine Schule holen"
      />

      <ul className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
        {points.map(({ body, title }) => (
          <li className="flex flex-col gap-2 border-t-2 border-primary-des pt-5" key={title}>
            <h3 className="text-xl text-primary-text">{title}</h3>
            <p className="text-lg/relaxed text-ink-soft text-pretty">{body}</p>
          </li>
        ))}
      </ul>

      <div>
        <Button asChild radius="pill" size="xl" variant="brand">
          <a href={externalLinks.schoolContact}>
            Gespräch anfragen
            <ArrowRight aria-hidden />
          </a>
        </Button>
      </div>
    </Container>
  </Section>
);
