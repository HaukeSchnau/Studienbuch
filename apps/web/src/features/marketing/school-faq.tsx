import { Container, Section, SectionHeading } from "#/ui/section.tsx";

const steps: ReadonlyArray<{ body: string; title: string }> = [
  {
    title: "Gespräch",
    body: "Eine halbe Stunde, in der wir zeigen, was die App kann, und Sie sagen, wie Ihre Schule arbeitet. Danach wissen beide Seiten, ob es passt.",
  },
  {
    title: "Testphase",
    body: "Ein Jahrgang oder ein paar Klassen bekommen Zugang, mit echten Stundenplänen. Bricht nichts ab, wenn es nicht passt.",
  },
  {
    title: "Rollout",
    body: "Zum Halbjahr oder zum Schuljahresbeginn für die ganze Schule. Den Import richten wir gemeinsam ein.",
  },
];

/**
 * The questions a school actually asks, answered before they have to be asked.
 *
 * `<details>` rather than a scripted accordion: it is keyboard-accessible, searchable by the
 * browser's find-in-page even when collapsed, and prints expanded — all of which matter when the
 * reader is assembling a procurement pack.
 */
const questions: ReadonlyArray<{ answer: string; question: string }> = [
  {
    question: "Was kostet das?",
    answer:
      "Abgerechnet wird pro Schülerin und Schüler und Schuljahr. Was das für Ihre Schule bedeutet, hängt von ihrer Größe und vom Umfang ab — die Zahl klären wir im Gespräch.",
  },
  {
    question: "Was passiert am Ende des Schuljahres mit den Daten?",
    answer:
      "Nichts, was die Schule nicht entscheidet. Sie ist datenschutzrechtlich verantwortlich, wir verarbeiten in ihrem Auftrag. Endet die Zusammenarbeit, werden die Daten nach Weisung der Schule gelöscht oder herausgegeben.",
  },
  {
    question: "Wie aufwendig ist die Einführung?",
    answer:
      "Der größte Teil ist der Import aus dem Stundenplansystem, und den richten wir ein. Für die Schule bleibt: entscheiden, wer Zugang bekommt, und die Lizenzschlüssel verteilen.",
  },
  {
    question: "Wen erreichen wir, wenn etwas nicht funktioniert?",
    answer:
      "Uns direkt, ohne Ticketsystem und ohne Hotline-Warteschleife. Studienbuch ist bewusst klein, und das ist an dieser Stelle ein Vorteil.",
  },
];

export const SchoolFaq = () => (
  <Section tone="background">
    <Container className="flex flex-col gap-14">
      <div className="flex flex-col gap-10">
        <SectionHeading
          lead="Die Einführung ist kein Projekt über Monate. Sie beginnt mit einem Gespräch und endet damit, dass niemand mehr ein Papierheft sucht."
          title="Wie es losgeht"
        />

        <ol className="stagger grid gap-8 sm:grid-cols-3">
          {steps.map(({ body, title }, index) => (
            <li className="reveal flex flex-col gap-3" key={title}>
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-full bg-primary text-base font-bold text-white"
              >
                {index + 1}
              </span>
              <h3 className="text-xl text-primary-text">{title}</h3>
              <p className="text-lg/relaxed text-ink-soft text-pretty">{body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-6">
        <h3 className="text-2xl text-primary-text">Häufige Fragen</h3>
        <ul className="flex flex-col gap-3">
          {questions.map(({ answer, question }) => (
            <li key={question}>
              <details className="group rounded-card bg-surface px-6 py-5 shadow-card">
                <summary className="press flex list-none items-center justify-between gap-4 text-lg font-bold text-ink marker:hidden">
                  {question}
                  <span
                    aria-hidden
                    className="shrink-0 text-2xl leading-none text-primary-pale transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-lg/relaxed text-ink-soft text-pretty">{answer}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </Container>
  </Section>
);
