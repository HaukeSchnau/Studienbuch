import { Site } from "#/domain-ui/Site.ts";
import { Blob } from "#/ui/Blob.tsx";

const points = [
  {
    title: "Import statt Doppelpflege",
    body: "Klassen, Kurse, Stundenpläne und Vertretungen kommen aus dem Stundenplansystem der Schule, etwa WebUntis. Niemand tippt einen Plan zweimal ab.",
  },
  {
    title: "Zugang über die Schule",
    body: "Schülerinnen und Schüler richten die App mit einem Zugangscode der Schule ein. Wer dazugehört, entscheidet die Schule, nicht eine offene Registrierung.",
  },
  {
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
 * What adopting Studienbuch means for a school, in the "Sie" the legal pages use: three plain
 * answers, the way in, the questions a school asks. The enquiry is an email, because the rewrite's
 * server has no enquiry endpoint yet.
 */
export function ForSchools() {
  return (
    <section className="section section-canvas schools" id={Site.sections.schools}>
      <Blob
        className="schools-blob"
        duration={22}
        offset={0.75}
        rotate={-12}
        outline="notch"
        tone="green"
      />
      <div className="container">
        <div className="section-heading">
          <h2>Studienbuch an Ihre Schule holen</h2>
          <p>
            Studienbuch ersetzt das Papier-Studienbuch für eine ganze Schule. Die Einführung beginnt
            mit einem Gespräch, nicht mit einem Vertrag.
          </p>
        </div>

        <ul className="school-points reveal-group">
          {points.map(({ title, body }) => (
            <li className="school-point reveal" key={title}>
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
          <div className="school-contact reveal">
            <p>
              Schreiben Sie uns, wie Ihre Schule heißt und wie viele Schülerinnen und Schüler sie
              hat. Wir melden uns innerhalb von zwei Werktagen.
            </p>
            <a className="button button-accent press" href={Site.schoolEnquiry}>
              Gespräch vereinbaren
            </a>
          </div>
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
