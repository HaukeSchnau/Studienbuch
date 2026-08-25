import { sectionIds } from "#/domain-ui/brand/links.ts";
import { Container, Section, SectionHeading } from "#/ui/section.tsx";

import { EdgeBlob } from "#/domain-ui/brand/blobs.tsx";

import { EnquiryForm } from "./enquiry-form.tsx";

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
    // "Keinen Platz" is the plain-German version of a real guarantee, for an audience of head
    // teachers rather than developers: `packages/observability` defines client records as a closed
    // union with literal attribute values and no free-text field, decoded with
    // `onExcessProperty: "error"`, so student data cannot travel through it. Phrasing it as a
    // property of the channel rather than as a list of tools we avoid keeps it true if a
    // product-analytics platform is added later.
    body: "Schuldaten liegen zuerst auf dem Gerät, dann auf Servern in Deutschland bei einem deutschen Anbieter — nie bei Werbenetzwerken. Was die App zur Fehlersuche meldet, hat für Namen oder Noten keinen Platz.",
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
      blob="twin"
      className="-left-48 top-12 hidden size-[22rem] min-[1440px]:block"
      rotate={38}
      tone="blue"
    />

    <EdgeBlob
      blob="notch"
      className="-right-48 top-52 hidden size-[20rem] min-[1440px]:block"
      rotate={-12}
      tone="green"
    />

    <Container className="flex flex-col gap-12">
      <SectionHeading
        lead="Studienbuch ersetzt das Papier-Studienbuch für eine ganze Schule. Die Einführung beginnt mit einem Gespräch, nicht mit einem Vertrag."
        title="Studienbuch an deine Schule holen"
      />

      <ol className="grid gap-x-10 gap-y-10 sm:grid-cols-3">
        {points.map(({ body, title }, index) => (
          <li className="reveal flex flex-col gap-3" key={title}>
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

      <EnquiryForm />
    </Container>
  </Section>
);
