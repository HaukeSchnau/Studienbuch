import { entity, processors, supervisoryAuthority } from "./entity.ts";
import { DetailBlock, LegalPage } from "./legal-page.tsx";

/**
 * Privacy notice for both surfaces, which have different controllers.
 *
 * On the website Urbs UG decides the purposes and is the controller. In the app the school does:
 * it licenses the product, decides who gets access, and supplies the timetable data, which makes
 * Urbs UG its processor under Art. 28 GDPR. That split runs through the whole document and is the
 * single most important thing for a lawyer to confirm against the actual school contracts.
 *
 * Every technical claim here is checked against the code: Sentry's options live in
 * `infra/observability/sentry-client.ts`, the telemetry envelope in `packages/observability`, and
 * the self-hosted font in `styles.css`.
 */
export const Datenschutz = () => (
  <LegalPage title="Datenschutzerklärung">
    <p>
      Diese Erklärung gilt für die Website <strong>studienbuch.app</strong> und für die
      Studienbuch-App für Android und iOS. Beide werden getrennt beschrieben, weil sich
      unterscheidet, wer über die Verarbeitung entscheidet.
    </p>

    <h2>1. Verantwortliche Stelle</h2>
    <p>Für diese Website ist verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO):</p>
    <DetailBlock label="Verantwortliche">
      {entity.legalName}
      <br />
      {entity.street}
      <br />
      {entity.postalCode} {entity.city}
      <br />
      {entity.country}
      <br />
      E-Mail: <a href={`mailto:${entity.email}`}>{entity.email}</a>
    </DetailBlock>
    <p>
      Für die in der App verarbeiteten Schuldaten ist die jeweilige Schule verantwortlich. Wir
      verarbeiten diese Daten ausschließlich in ihrem Auftrag und nach ihren Weisungen (Artikel 28
      DSGVO). Näheres unter Abschnitt 3.
    </p>
    <p>
      Eine Datenschutzbeauftragte oder einen Datenschutzbeauftragten müssen wir nach Artikel&nbsp;37
      DSGVO nicht benennen. Fragen zum Datenschutz richten Sie bitte an die oben genannte
      E-Mail-Adresse.
    </p>

    <h2>2. Nutzung der Website</h2>

    <h3>Server-Logfiles</h3>
    <p>
      Beim Aufruf der Website übermittelt Ihr Browser technisch notwendige Daten, die unser Server
      protokolliert: IP-Adresse, Datum und Uhrzeit des Zugriffs, die abgerufene Adresse, den
      HTTP-Statuscode, die übertragene Datenmenge sowie Browser- und Betriebssystemkennung.
    </p>
    <p>
      Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe f DSGVO. Unser berechtigtes Interesse liegt
      im sicheren und stabilen Betrieb der Website sowie in der Abwehr von Angriffen. Die Daten
      werden nur so lange gespeichert, wie es dafür erforderlich ist, und anschließend gelöscht.
      Eine Zusammenführung mit anderen Daten findet nicht statt.
    </p>

    <h3>Keine Cookies, keine Reichweitenmessung</h3>
    <p>
      Diese Website setzt keine Cookies und bindet keine Werbe- oder Analysedienste ein. Es findet
      keine Reichweitenmessung und kein geräteübergreifendes Wiedererkennen statt. Eine Einwilligung
      nach §&nbsp;25 TDDDG ist deshalb nicht erforderlich.
    </p>

    <h3>Schriftarten</h3>
    <p>
      Die verwendete Schriftart wird von unserem eigenen Server ausgeliefert. Es besteht keine
      Verbindung zu Google Fonts oder einem anderen fremden Content-Delivery-Network, und es wird
      keine IP-Adresse an Dritte übertragen.
    </p>

    <h3>Fehlerberichte</h3>
    <p>
      Zur Erkennung technischer Fehler setzen wir Sentry ein. Übermittelt werden ausschließlich
      technische Angaben zum Fehler, etwa Fehlermeldung, Programmzeile, Browsertyp und
      Betriebssystem. Die Übermittlung personenbezogener Standardangaben ist abgeschaltet (
      <code>sendDefaultPii: false</code>). Eine Sitzungsaufzeichnung findet im Normalbetrieb nicht
      statt; wird im Fehlerfall eine Aufzeichnung erstellt, sind sämtliche Texte, Eingaben und
      Medien unkenntlich gemacht. Wir nutzen die EU-Region von Sentry, die Verarbeitung findet in
      Rechenzentren in der Europäischen Union statt.
    </p>
    <p>Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe f DSGVO (fehlerfreier Betrieb).</p>

    <h3>Kontaktaufnahme</h3>
    <p>
      Wenn Sie uns per E-Mail schreiben, verarbeiten wir Ihre Angaben zur Bearbeitung der Anfrage.
      Rechtsgrundlage ist Artikel 6 Absatz 1 Buchstabe b DSGVO bei vertragsbezogenen Anfragen, sonst
      Artikel 6 Absatz 1 Buchstabe f DSGVO. Wir löschen die Nachrichten, sobald sie nicht mehr
      benötigt werden und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.
    </p>

    <h2>3. Nutzung der App</h2>

    <h3>Rollenverteilung</h3>
    <p>
      Die App wird von Schulen lizenziert. Die Schule entscheidet, welche Daten verarbeitet werden
      und wer Zugang erhält, und ist damit datenschutzrechtlich verantwortlich. Wir stellen die
      technische Verarbeitung bereit und handeln als Auftragsverarbeiterin nach Artikel&nbsp;28
      DSGVO. Grundlage ist ein Vertrag zur Auftragsverarbeitung mit der jeweiligen Schule.
    </p>
    <p>
      Anfragen zu Ihren Daten in der App richten Sie deshalb bitte zuerst an Ihre Schule. Wenn Sie
      sich an uns wenden, leiten wir die Anfrage an die Schule weiter oder unterstützen sie bei der
      Beantwortung.
    </p>

    <h3>Verarbeitete Daten</h3>
    <ul>
      <li>Stammdaten des Profils, etwa Name, Schuljahr, Klasse und belegte Kurse</li>
      <li>Stundenplan, Vertretungen und Kursinformationen</li>
      <li>Noten und die dazugehörigen Bestätigungen, einschließlich erfasster Unterschriften</li>
      <li>Fehlzeiten mit Datum, Grund und Entschuldigungsstand</li>
      <li>Aufgaben mit Fälligkeit sowie von Ihnen hinzugefügte Fotos</li>
      <li>Der von der Schule ausgegebene Lizenzschlüssel und technische Gerätekennungen</li>
    </ul>

    <h3>Speicherung auf dem Gerät</h3>
    <p>
      Studienbuch ist local-first aufgebaut: Ihre Daten werden zuerst auf dem Gerät gespeichert und
      mit unseren Servern abgeglichen, sobald eine Verbindung besteht. Die App ist dadurch auch ohne
      Netz nutzbar.
    </p>

    <h3>Übernahme aus dem Stundenplansystem</h3>
    <p>
      Klassen, Kurse, Stundenpläne und Vertretungen werden aus dem Stundenplansystem der Schule
      übernommen, etwa WebUntis. Die Schule entscheidet über diese Übermittlung und über ihren
      Umfang.
    </p>

    <h3>Technische Messwerte</h3>
    <p>
      App und Website melden einen eng begrenzten Satz technischer Messwerte an unseren Server,
      damit wir Fehler und Leistungsprobleme erkennen. Das Format ist fest vorgegeben und enthält
      kein Freitextfeld; übermittelt werden können ausschließlich vorab festgelegte Bezeichnungen
      und Werte. Namen, Noten, Fehlzeiten oder Aufgabeninhalte können darin technisch nicht
      enthalten sein. Der Server weist Datensätze zurück, die von diesem Format abweichen.
    </p>

    <h3>Minderjährige</h3>
    <p>
      Die App richtet sich an Schülerinnen und Schüler und wird überwiegend von Minderjährigen
      genutzt. Die Verarbeitung erfolgt nicht auf Grundlage einer Einwilligung der Nutzenden,
      sondern im Auftrag und auf Grundlage der Schule. Bestätigungen, die eine Zustimmung der Eltern
      erfordern, bildet die App als solche ab.
    </p>

    <h2>4. Empfänger und Auftragsverarbeiter</h2>
    <p>
      Wir geben personenbezogene Daten nicht zu Werbezwecken weiter und verkaufen sie nicht.
      Eingebunden sind ausschließlich die folgenden Dienstleister, jeweils auf Grundlage eines
      Vertrags zur Auftragsverarbeitung:
    </p>
    <ul>
      {processors.map((processor) => (
        <li key={processor.name}>
          <strong>{processor.name}</strong>, {processor.address} — {processor.purpose}. Verarbeitung
          in: {processor.location}.
        </li>
      ))}
    </ul>
    <p>
      Unsere Server stehen bei einem deutschen Anbieter in Deutschland. Eine Übermittlung
      personenbezogener Daten in ein Land außerhalb der Europäischen Union findet nicht statt.
    </p>

    <h2>5. Speicherdauer</h2>
    <p>
      Schuldaten werden gespeichert, solange die Schule die App einsetzt, und nach Beendigung nach
      ihren Weisungen gelöscht oder zurückgegeben. Daten auf dem Gerät werden mit der Deinstallation
      der App entfernt. Gesetzliche Aufbewahrungspflichten, etwa aus Handels- und Steuerrecht,
      bleiben unberührt.
    </p>

    <h2>6. Ihre Rechte</h2>
    <p>Sie haben nach der DSGVO das Recht auf</p>
    <ul>
      <li>Auskunft über die zu Ihnen gespeicherten Daten (Artikel&nbsp;15)</li>
      <li>Berichtigung unrichtiger Daten (Artikel&nbsp;16)</li>
      <li>Löschung (Artikel&nbsp;17)</li>
      <li>Einschränkung der Verarbeitung (Artikel&nbsp;18)</li>
      <li>Datenübertragbarkeit (Artikel&nbsp;20)</li>
      <li>
        Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Artikel&nbsp;21)
      </li>
    </ul>
    <p>
      Soweit eine Verarbeitung auf einer Einwilligung beruht, können Sie diese jederzeit mit Wirkung
      für die Zukunft widerrufen (Artikel 7 Absatz 3 DSGVO).
    </p>

    <h2>7. Beschwerderecht</h2>
    <p>
      Sie können sich jederzeit bei einer Datenschutz-Aufsichtsbehörde beschweren (Artikel&nbsp;77
      DSGVO). Für uns zuständig ist:
    </p>
    <DetailBlock label="Aufsichtsbehörde">
      {supervisoryAuthority.name}
      <br />
      {supervisoryAuthority.address}
      <br />
      <a href={supervisoryAuthority.url} rel="noreferrer" target="_blank">
        {supervisoryAuthority.url.replace("https://", "")}
      </a>
    </DetailBlock>

    <h2>8. Änderungen dieser Erklärung</h2>
    <p>
      Wir passen diese Erklärung an, wenn sich die Verarbeitung ändert. Es gilt jeweils die hier
      veröffentlichte Fassung mit dem oben genannten Stand.
    </p>
  </LegalPage>
);
