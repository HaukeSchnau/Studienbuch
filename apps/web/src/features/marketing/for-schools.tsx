import { ArrowRight } from "lucide-react";

import { externalLinks, sectionIds } from "#/domain-ui/brand/links.ts";
import { Button } from "#/ui/button.tsx";
import { Container, Section, SectionHeading } from "#/ui/section.tsx";

import { EdgeBlob } from "#/domain-ui/brand/blobs.tsx";

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

/**
 * The points are numbered rather than bulleted, in the same oversized green Nunito as the headings.
 * It reads as a short, plain answer to "what would this actually mean for us" instead of a feature
 * list, which is what a school reading this page is asking.
 */
export const ForSchools = () => (
  <Section className="relative isolate" id={sectionIds.schools}>
    <EdgeBlob
      blob="notch"
      className="-left-36 top-12 hidden size-[22rem] xl:block"
      rotate={38}
      tone="green"
    />

    <Container className="flex flex-col gap-12">
      <SectionHeading
        lead="Studienbuch ersetzt das Papier-Studienbuch für eine ganze Schule. Die Einführung beginnt mit einem Gespräch, nicht mit einem Vertrag."
        title="Studienbuch an deine Schule holen"
      />

      <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-3">
        {points.map(({ body, title }, index) => (
          <li className="flex flex-col gap-3" key={title}>
            <span
              aria-hidden
              className="text-5xl leading-none font-bold text-primary-pale tabular-nums"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-xl text-primary-text">{title}</h3>
            <p className="text-lg/relaxed text-ink-soft text-pretty">{body}</p>
          </li>
        ))}
      </ol>

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
