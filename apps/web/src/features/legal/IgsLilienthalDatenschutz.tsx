import { LegalPage } from "./LegalPage.tsx";
import { Operator } from "./Operator.ts";

// Its own date, so this page and the main notice each change their "Stand" only with their text.
const updated = { de: "19. November 2026", en: "19 November 2026" } as const;

// oxlint-disable-next-line studienbuch/no-baked-origin -- Urbs's text names beta's notice for 2.0.0, wherever this page is served.
const betaNotice = "https://beta.studienbuch.app/datenschutz";

/**
 * The privacy policy the Play listing "IGS Lilienthal" (the legacy app, package
 * dev.schnau.studienbuch) links to. The wording is Urbs's, approved word for word in German and
 * English: change it only with new text from Urbs.
 */
export function IgsLilienthalDatenschutz() {
  const { entity, supervisoryAuthority } = Operator;
  const email = <a href={`mailto:${entity.email}`}>{entity.email}</a>;

  return (
    <LegalPage
      title={
        'Datenschutzerklärung für die App „IGS Lilienthal" (Android, Paket dev.schnau.studienbuch)'
      }
      updated={updated.de}
    >
      <h2>1. Anbieter und Verantwortlicher</h2>
      <p>
        Die App „IGS Lilienthal&quot; (bei Google Play unter dem Paketnamen dev.schnau.studienbuch)
        ist eine Ausgabe von Studienbuch, dem digitalen Hausaufgaben- und Schulplanerheft.
        Anbieterin und Entwicklerin ist die
      </p>
      <address>
        {entity.legalName}, bei Google Play als „Urbs&quot; geführt
        <br />
        {entity.street}, {entity.postalCode} {entity.city}, {entity.country}
        <br />
        vertreten durch den Geschäftsführer {entity.representative}
        <br />
        {entity.registerCourt}, {entity.registerNumber}
        <br />
        E-Mail: {email}
      </address>
      <p>
        Sie ist Verantwortliche für die Daten, die die App an ihre Server sendet (Artikel&nbsp;4
        Nr.&nbsp;7 DSGVO).
      </p>

      <h2>2. Welche Version diese Erklärung betrifft</h2>
      <p>
        Über Google Play erhalten Nutzerinnen und Nutzer die aktuelle Fassung der App
        (Abschnitt&nbsp;3). Testerinnen und Tester im internen Testprogramm erhalten außerdem
        Studienbuch 2.0.0. Für Version 2.0.0 gilt die Datenschutzerklärung unter{" "}
        <a href={betaNotice}>{betaNotice}</a>.
      </p>

      <h2>3. Was die App verarbeitet</h2>
      <p>
        <em>Nur auf Ihrem Gerät:</em> Ihr Profil (der Name, den Sie eintragen, und ob Sie volljährig
        sind), Stundenplan und Kurswahl, Hausaufgaben mit Fotos, Noten, Fehlzeiten mit ihren Gründen
        sowie Unterschriften von Eltern und Lehrkräften. Diese Daten speichert die App auf Ihrem
        Gerät. Sie werden nicht an uns übertragen, und wir können sie nicht einsehen. Fotos fügen
        Sie selbst über die Kamera oder die Fotoauswahl Ihres Geräts hinzu. Mit der Deinstallation
        der App werden diese Daten gelöscht.
      </p>
      <p>
        <em>An unseren Server (studienbuch.app):</em> Damit die App funktioniert, sendet sie
      </p>
      <ul>
        <li>
          den Lizenzschlüssel Ihrer Schule, um ihn zu prüfen und zu aktivieren. Wir speichern, wann
          er aktiviert wurde.
        </li>
        <li>
          die Kennungen des gewählten Schuljahrs, der Klasse, der Kurse und der Lehrkräfte sowie den
          Zeitpunkt des letzten Abgleichs, um Stundenplan, Kurse, Lehrkräfte und Vertretungen
          herunterzuladen.
        </li>
      </ul>
      <p>Namen, Noten, Fehlzeiten, Hausaufgaben oder Fotos sendet die App nicht.</p>
      <p>
        Beim Abruf verarbeitet der Server technisch notwendige Verbindungsdaten (IP-Adresse,
        Zeitpunkt, abgerufene Adresse, Geräte- und App-Kennung im Browser- bzw. App-Header). Er
        löscht sie, sobald sie für den sicheren Betrieb nicht mehr benötigt werden.
      </p>
      <p>
        Rechtsgrundlagen sind Artikel&nbsp;6 Absatz&nbsp;1 Buchstabe&nbsp;b DSGVO (Bereitstellung
        der App) und Buchstabe&nbsp;f DSGVO (sicherer Betrieb).
      </p>
      <p>
        <em>Feedback:</em> Die Feedback-Funktion öffnet Ihr E-Mail-Programm mit unserer Adresse.
        Ihre E-Mail verarbeiten wir zur Bearbeitung Ihrer Anfrage.
      </p>
      <p>
        <em>Keine Analyse- und Werbedienste:</em> Die App enthält keine Werbung, keine
        Analysedienste und keine Dienste zur Fehlerberichterstattung, die Daten an Dritte senden.
      </p>

      <h2>4. Empfänger</h2>
      <p>
        Die Server werden in Deutschland betrieben, von der STRATO GmbH (Berlin) und der netcup GmbH
        (Karlsruhe). Wir geben keine Daten zu Werbezwecken weiter und verkaufen sie nicht.
      </p>

      <h2>5. Speicherdauer</h2>
      <p>
        Daten auf Ihrem Gerät bleiben dort, bis Sie sie in der App löschen oder die App
        deinstallieren. Die Aktivierung des Lizenzschlüssels speichern wir, solange die Lizenz Ihrer
        Schule läuft.
      </p>

      <h2>6. Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft (Artikel&nbsp;15 DSGVO), Berichtigung (Artikel&nbsp;16),
        Löschung (Artikel&nbsp;17), Einschränkung der Verarbeitung (Artikel&nbsp;18),
        Datenübertragbarkeit (Artikel&nbsp;20) und Widerspruch gegen Verarbeitungen auf Grundlage
        berechtigter Interessen (Artikel&nbsp;21). Schreiben Sie dazu an {email}.
      </p>
      <p>
        Sie können sich bei einer Datenschutz-Aufsichtsbehörde beschweren, für uns zuständig ist der
        Hamburgische Beauftragte für Datenschutz und Informationsfreiheit,{" "}
        {supervisoryAuthority.address}.
      </p>

      <h2>7. Impressum</h2>
      <p>
        <a href="/impressum">Impressum von Urbs UG</a>
      </p>

      <section className="legal-translation" lang="en">
        <h2>
          Privacy policy for the app &quot;IGS Lilienthal&quot; (Android, package
          dev.schnau.studienbuch)
        </h2>
        <p className="legal-updated">Last updated: {updated.en}</p>
        <p>
          <strong>1. Provider and controller.</strong> The app &quot;IGS Lilienthal&quot; (package
          dev.schnau.studienbuch on Google Play) is an edition of Studienbuch, a digital homework
          planner. It is published by {entity.legalName}, listed on Google Play as &quot;Urbs&quot;,{" "}
          {entity.street}, {entity.postalCode} {entity.city}, Germany, represented by its managing
          director {entity.representative}, {entity.registerCourt} {entity.registerNumber}, {email}.
          Urbs UG is the controller for the data the app sends to its servers.
        </p>
        <p>
          <strong>2. Versions.</strong> Google Play delivers the current version described here.
          Internal testers also receive Studienbuch 2.0.0, which is governed by{" "}
          <a href={betaNotice}>{betaNotice}</a>.
        </p>
        <p>
          <strong>3. Data processed.</strong>
        </p>
        <ul>
          <li>
            <strong>On your device only:</strong> your profile (the name you enter, whether you are
            an adult), timetable and course choices, homework with photos, grades, absences with
            reasons, and signatures. They are stored on your device only, never sent to us, and
            deleted when you uninstall the app. You add photos yourself through your device&apos;s
            camera or photo picker.
          </li>
          <li>
            <strong>Sent to our server (studienbuch.app):</strong> your school&apos;s licence key,
            to check and activate it (we store the activation time); and the identifiers of the
            selected school year, class, courses and teachers with the time of the last sync, to
            download timetable, courses, teachers and substitutions. No names, grades, absences,
            homework or photos are sent. The server processes technically necessary connection data
            (IP address, time, requested address, device and app identifiers in request headers) and
            deletes it once it is no longer needed for secure operation.
          </li>
          <li>
            <strong>Legal bases:</strong> Art.&nbsp;6(1)(b) GDPR (providing the app) and
            Art.&nbsp;6(1)(f) GDPR (secure operation).
          </li>
          <li>
            <strong>Feedback</strong> opens your email app addressed to us.
          </li>
          <li>
            The app contains no ads, analytics or crash-reporting services that send data to third
            parties.
          </li>
        </ul>
        <p>
          <strong>4. Recipients.</strong> Servers are operated in Germany by STRATO GmbH (Berlin)
          and netcup GmbH (Karlsruhe). We do not sell data or share it for advertising.
        </p>
        <p>
          <strong>5. Retention.</strong> Data on your device stays until you delete it or uninstall
          the app. Licence activations are kept for as long as your school&apos;s licence runs.
        </p>
        <p>
          <strong>6. Your rights.</strong> You have the rights of access, rectification, erasure,
          restriction, data portability and objection (Art.&nbsp;15 to 18, 20 and 21 GDPR); write to{" "}
          {email}. You may complain to a supervisory authority; ours is the Hamburg Commissioner for
          Data Protection and Freedom of Information, {supervisoryAuthority.address}.
        </p>
        <p>
          <strong>7. Legal notice:</strong> <a href="/impressum">Urbs UG&apos;s Impressum</a>
        </p>
      </section>
    </LegalPage>
  );
}
