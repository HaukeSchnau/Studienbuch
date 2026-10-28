import { AbsenceCard } from "#/domain-ui/app/AbsenceCard.tsx";

/**
 * Why the product exists, shown rather than said: the same record, a day of absences, in the paper
 * booklet and in the app. The paper is drawn, not photographed: ruled lines, a coffee ring, a
 * crossed-out entry and a missing signature are enough for anyone who has held one.
 */
export function PaperContrast() {
  return (
    <section className="section section-canvas paper-contrast">
      <div className="container">
        <div className="paper-compare reveal-group">
          <div className="paper-side reveal">
            <p className="paper-label">Vorher</p>
            <div aria-hidden className="paper-page">
              <span className="paper-coffee" />
              <p className="paper-heading">Fehlzeiten</p>
              <p className="paper-line">12.10. 1 Std.</p>
              <p className="paper-line paper-struck">14.10. 2 Std.</p>
              <p className="paper-line paper-smudge">15.10. 3 Std. ent…</p>
              <p className="paper-signature">Unterschrift</p>
              <span className="paper-signature-line" />
            </div>
          </div>

          <p aria-hidden className="paper-arrow">
            →
          </p>

          <div className="paper-side reveal app-settle">
            <p className="paper-label paper-label-app">Nachher</p>
            <div className="paper-app">
              <AbsenceCard days={1} unexcused={2} />
            </div>
          </div>
        </div>

        <p className="paper-caption">
          Ein Studienbuch aus Papier geht verloren, wird nass und ist am Ende des Halbjahres kaum
          noch zu entziffern. Dieselben Einträge in der App sind nachvollziehbar und immer dabei.
        </p>
      </div>
    </section>
  );
}
