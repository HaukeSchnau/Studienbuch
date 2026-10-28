import { Site } from "#/domain-ui/Site.ts";
import { AppIcon } from "#/domain-ui/Wordmark.tsx";
import { Blob } from "#/ui/Blob.tsx";

const points = [
  {
    icon: "M12 3v11M7.5 9.5 12 14l4.5-4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3",
    title: "Import statt Doppelpflege",
    body: "Klassen, Kurse, Stundenpläne und Vertretungen kommen aus dem Stundenplansystem der Schule, etwa WebUntis. Niemand tippt einen Plan zweimal ab.",
  },
  {
    icon: "M14.5 9.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM13.4 12.4 20 19M17 16l2-2M15.5 14.5l1.5-1.5",
    title: "Zugang über die Schule",
    body: "Schülerinnen und Schüler richten die App mit einem Zugangscode der Schule ein. Wer dazugehört, entscheidet die Schule, nicht eine offene Registrierung.",
  },
  {
    icon: "M3 6a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v8H3zM1.5 17h16M18 9h3.5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H18a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z",
    title: "Auf jedem Gerät",
    body: "iPhone, Android oder der Browser im Computerraum: Es ist dieselbe App, und sie gleicht sich zwischen den Geräten ab.",
  },
] as const;

const steps = [
  {
    title: "Gespräch",
    body: "Eine halbe Stunde, in der wir zeigen, was die App kann, und Sie erzählen, wie Ihre Schule arbeitet. Danach wissen beide Seiten, ob es passt.",
  },
  {
    title: "Testphase",
    body: "Ein Jahrgang oder ein paar Klassen bekommen Zugang, mit echten Stundenplänen. Passt es nicht, endet die Testphase ohne Folgen.",
  },
  {
    title: "Für alle",
    body: "Zum Halbjahr oder zum Schuljahresbeginn für die ganze Schule. Den Import richten wir gemeinsam ein.",
  },
] as const;

// `<details>` rather than a scripted accordion: keyboard-accessible, found by the browser's search
// while closed, and printed open, which matters when a school files the page.
const questions = [
  {
    question: "Was kostet das?",
    answer:
      "Abgerechnet wird pro Schülerin und Schüler und Schuljahr. Was das für Ihre Schule bedeutet, hängt von ihrer Größe ab. Die Zahl klären wir im Gespräch.",
  },
  {
    question: "Können Sie die Noten unserer Schülerinnen und Schüler lesen?",
    answer:
      "Nein. Noten, Fehlzeiten, Hausaufgaben, Fotos und Unterschriften werden auf dem Gerät verschlüsselt, und nur die Geräte der Schülerin oder des Schülers haben den Schlüssel. Lesbar sind für uns die E-Mail-Adresse, die Kurswahl, wann Geräte sich melden, die ungefähre Größe der Einträge und die Schuldaten aus dem Import.",
  },
  {
    question: "Was passiert, wenn jemand sein Handy verliert?",
    answer:
      "Mit einem zweiten Gerät oder der Notfallkarte, die die App beim Einrichten ausgibt, ist alles wieder da. Ohne beides können auch wir die verschlüsselten Einträge nicht wiederherstellen. Stundenplan und Kurse kommen trotzdem zurück.",
  },
  {
    question: "Was passiert am Ende mit den Daten?",
    answer:
      "Was die Schule entscheidet. Sie ist datenschutzrechtlich verantwortlich, wir verarbeiten in ihrem Auftrag. Endet die Zusammenarbeit, löschen wir die Daten nach Weisung der Schule.",
  },
  {
    question: "Wie aufwendig ist die Einführung?",
    answer:
      "Der größte Teil ist der Import aus dem Stundenplansystem, und den richten wir ein. Für die Schule bleibt: entscheiden, wer Zugang bekommt, und die Zugangscodes verteilen.",
  },
  {
    question: "Wen erreichen wir, wenn etwas nicht funktioniert?",
    answer:
      "Uns direkt, ohne Ticketsystem und ohne Warteschleife. Studienbuch ist bewusst klein, und das ist an dieser Stelle ein Vorteil.",
  },
] as const;

/**
 * A printed access code, the slip a school hands out. Drawn, like the paper booklet above. The
 * slip behind gets no `code` and shows only the brand line, so no half-covered words peek out.
 */
function AccessSlip({ code, className }: { code?: string; className: string }) {
  return (
    <div className={`slip ${className}`}>
      <p className="slip-brand">
        <AppIcon size="small" />
        Studienbuch
      </p>
      {code === undefined ? null : (
        <>
          <p className="slip-school">IGS Musterstadt</p>
          <p className="slip-label">Dein Zugangscode</p>
          <p className="slip-code">{code}</p>
          <p className="slip-note">Einmal gültig. Gib ihn beim Einrichten der App ein.</p>
        </>
      )}
    </div>
  );
}

/**
 * What adopting Studienbuch means for a school, in the "Sie" the legal pages use. It opens like the
 * hero, with the way in at hand: a conversation, by email, because the rewrite's server has no
 * enquiry endpoint yet. The slips show what reaches students: a code from their school.
 */
export function ForSchools() {
  return (
    <section className="section section-canvas schools" id={Site.sections.schools}>
      <div className="container">
        <div className="schools-intro reveal">
          <Blob
            className="schools-intro-blob"
            duration={22}
            offset={0.75}
            outline="notch"
            rotate={-12}
            tone="green"
          />
          <Blob
            className="schools-intro-blob-blue"
            duration={28}
            offset={0.3}
            outline="twin"
            rotate={140}
            tone="blue"
          />
          <div className="schools-intro-text">
            <h2>Studienbuch an Ihre Schule holen</h2>
            <p className="schools-lead">
              Studienbuch ersetzt das Papier-Studienbuch für eine ganze Schule. Die Einführung
              beginnt mit einem Gespräch, nicht mit einem Vertrag.
            </p>
            <div className="schools-cta">
              <a className="button button-accent press" href={Site.schoolEnquiry}>
                Gespräch vereinbaren
              </a>
              <p>
                oder an <a href={`mailto:${Site.email}`}>{Site.email}</a>. Wir melden uns innerhalb
                von zwei Werktagen.
              </p>
            </div>
          </div>
          <div aria-hidden className="slips">
            <AccessSlip className="slip-back" />
            <AccessSlip className="slip-front" code="K7QF 2MDX" />
          </div>
        </div>

        <ul className="school-points reveal-group">
          {points.map(({ icon, title, body }) => (
            <li className="school-point reveal" key={title}>
              <svg aria-hidden className="benefit-icon" viewBox="0 0 24 24">
                <path d={icon} />
              </svg>
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>

        <div className="school-steps-block">
          <h3 className="school-subheading">Wie es losgeht</h3>
          <ol className="school-steps reveal-group">
            {steps.map(({ title, body }, index) => (
              <li className="school-step reveal" key={title}>
                <span aria-hidden className="school-step-number">
                  {index + 1}
                </span>
                <h4>{title}</h4>
                <p>{body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="faq">
          <h3 className="school-subheading">Häufige Fragen</h3>
          <ul>
            {questions.map(({ question, answer }) => (
              <li key={question}>
                <details className="faq-item">
                  <summary className="press">
                    {question}
                    <span aria-hidden className="faq-toggle">
                      +
                    </span>
                  </summary>
                  <p>{answer}</p>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
