import { DetailBlock, LegalPage } from "./LegalPage.tsx";
import { Operator } from "./Operator.ts";

/**
 * The privacy notice for the website and the app, which have different controllers: Urbs UG for
 * the website, the school for the app, with Urbs UG as its processor (Art. 28 GDPR). The claims
 * about encryption follow encryption.md and D42: they name what the server still reads, and the
 * limit that we ship the app's code ourselves.
 */
export function Datenschutz() {
  const { entity, processors, supervisoryAuthority } = Operator;

  return (
    <LegalPage title="Datenschutzerklärung">
      <p>
        Diese Erklärung gilt für die Website <strong>studienbuch.app</strong> und für die
        Studienbuch-App für Android, iOS und den Browser. Beide werden getrennt beschrieben, weil
        sich unterscheidet, wer über die Verarbeitung entscheidet.
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
        verarbeiten diese Daten ausschließlich in ihrem Auftrag und nach ihren Weisungen
        (Artikel&nbsp;28 DSGVO). Näheres unter Abschnitt&nbsp;3.
      </p>
      <p>
        Eine Datenschutzbeauftragte oder einen Datenschutzbeauftragten müssen wir nach
        Artikel&nbsp;37 DSGVO nicht benennen. Fragen zum Datenschutz richten Sie bitte an die oben
        genannte E-Mail-Adresse.
      </p>

      <h2>2. Nutzung der Website</h2>

      <h3>Server-Logfiles</h3>
      <p>
        Beim Aufruf der Website übermittelt Ihr Browser technisch notwendige Daten, die unser Server
        protokolliert: IP-Adresse, Datum und Uhrzeit des Zugriffs, die abgerufene Adresse, den
        HTTP-Statuscode, die übertragene Datenmenge sowie Browser- und Betriebssystemkennung.
      </p>
      <p>
        Rechtsgrundlage ist Artikel&nbsp;6 Absatz&nbsp;1 Buchstabe&nbsp;f DSGVO. Unser berechtigtes
        Interesse liegt im sicheren und stabilen Betrieb der Website sowie in der Abwehr von
        Angriffen. Die Daten werden nur so lange gespeichert, wie es dafür erforderlich ist, und
        anschließend gelöscht. Eine Zusammenführung mit anderen Daten findet nicht statt.
      </p>

      <h3>Keine Cookies auf den informativen Seiten</h3>
      <p>
        Die Startseite, dieses Impressum und diese Datenschutzerklärung setzen keine Cookies und
        speichern nichts in Ihrem Browser. Wir binden keine Werbe- oder Analysedienste ein.
      </p>

      <h3>Schriftarten</h3>
      <p>
        Die verwendete Schriftart wird von unserem eigenen Server ausgeliefert. Es besteht keine
        Verbindung zu Google Fonts oder einem anderen fremden Content-Delivery-Network, und es wird
        keine IP-Adresse an Dritte übertragen.
      </p>

      <h3>Kontaktaufnahme</h3>
      <p>
        Wenn Sie uns per E-Mail schreiben, verarbeiten wir Ihre Angaben zur Bearbeitung der Anfrage.
        Rechtsgrundlage ist Artikel&nbsp;6 Absatz&nbsp;1 Buchstabe&nbsp;b DSGVO bei
        vertragsbezogenen Anfragen, sonst Artikel&nbsp;6 Absatz&nbsp;1 Buchstabe&nbsp;f DSGVO. Wir
        löschen die Nachrichten, sobald sie nicht mehr benötigt werden und keine gesetzlichen
        Aufbewahrungspflichten entgegenstehen.
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
        sich an uns wenden, leiten wir die Anfrage an die Schule weiter oder unterstützen sie bei
        der Beantwortung.
      </p>

      <h3>Ende-zu-Ende-Verschlüsselung</h3>
      <p>
        Was Sie selbst in Ihr Studienbuch eintragen, wird auf Ihrem Gerät verschlüsselt, bevor es
        das Gerät verlässt: Noten, Unterschriften, Fehlzeiten mit ihren Gründen, Hausaufgaben, Fotos
        und Ihr Profil mit Ihrem Namen. Auf unseren Servern liegen diese Inhalte nur verschlüsselt.
        Die Schlüssel haben ausschließlich Ihre Geräte. Wir können diese Inhalte weder lesen noch
        herausgeben oder wiederherstellen.
      </p>
      <p>
        Die Verschlüsselung schützt Ihre Inhalte, wenn Daten von unseren Servern abfließen oder
        jemand unbefugt auf sie zugreift. Sie hat zwei Grenzen, die für jede vergleichbare App
        gelten: Wir liefern die App selbst aus, im Browser bei jedem Aufruf, und eine absichtlich
        veränderte App könnte Inhalte vor der Verschlüsselung abgreifen. Und auf einem entsperrten
        Gerät sind die Inhalte so lesbar wie in jeder anderen App.
      </p>

      <h3>Verarbeitete Daten</h3>
      <p>Diese Daten können wir lesen, weil Anmeldung, Abgleich und Stundenplan sie brauchen:</p>
      <ul>
        <li>
          Kontodaten: E-Mail-Adresse, Bestätigungsstatus und Anmeldedaten. Bei einem Passkey sind
          das dessen öffentliche Schlüsseldaten; biometrische Merkmale verlassen Ihr Gerät nicht.
        </li>
        <li>
          Sitzungs- und Gerätedaten wie Ablaufzeit, IP-Adresse, Browser- und Gerätekennung, die
          Zeitpunkte, zu denen sich Ihre Geräte melden, sowie kurzlebige Bestätigungs- und
          Wiederherstellungstoken
        </li>
        <li>
          beim Versand von Konto-E-Mails die Empfängeradresse, den Nachrichteninhalt und technische
          Zustellinformationen
        </li>
        <li>
          Schulzugang, Zugangsart und Status des eingelösten Zugangscodes; der Code selbst wird nur
          als kryptografischer Hash gespeichert
        </li>
        <li>Ihre Kurswahl, also welche Kurse Sie in welchem Halbjahr belegen</li>
        <li>Stundenplan, Vertretungen und Kursinformationen Ihrer Schule</li>
        <li>
          die ungefähre Größe Ihrer verschlüsselten Einträge, die wir auf feste Stufen aufgefüllt
          speichern
        </li>
        <li>
          verschlüsselte Sicherungen Ihrer Schlüssel, die sich nur mit Ihrem Passkey, einem Ihrer
          Geräte oder Ihrer Notfallkarte öffnen lassen
        </li>
      </ul>
      <p>
        Nur verschlüsselt erreichen uns: Noten und Unterschriften, Fehlzeiten mit Gründen,
        Hausaufgaben, Fotos und Ihr Profil im Studienbuch.
      </p>

      <h3>Konto und Schulzugang</h3>
      <p>
        Ein Konto kann länger bestehen als ein einzelner Schulzugang. Die E-Mail-Adresse dient der
        Anmeldung, Bestätigung und Wiederherstellung; sie wird nicht als Nachweis einer
        Schulzugehörigkeit verwendet. Die Schule erhält von uns keine Zuordnung zwischen Zugangscode
        und Konto oder E-Mail-Adresse.
      </p>
      <p>
        Zugangscodes enthalten nur die Schule und die Zugangsart „Schülerin oder Schüler“ oder
        „Lehrkraft“. Sie enthalten keinen Namen und keine Klasse. Ihren Namen tragen Sie selbst ein,
        und er liegt nur verschlüsselt bei uns. Automatisch importierte Schuldaten werden nicht
        allein aufgrund gleicher Namen oder E-Mail-Adressen mit Ihrem Konto verknüpft.
      </p>

      <h3>Speicherung auf dem Gerät</h3>
      <p>
        Studienbuch speichert Ihre Daten zuerst in einer Datenbank auf Ihrem Gerät und gleicht sie
        mit unseren Servern ab, sobald eine Verbindung besteht. Die App ist dadurch auch ohne Netz
        nutzbar. Im Browser liegen diese Datenbank, ein Sitzungscookie und ein Schlüssel, der Ihre
        Daten auf diesem Gerät schützt, im Speicher des Browsers. Das ist für den von Ihnen
        angeforderten Dienst unbedingt erforderlich (§&nbsp;25 Absatz&nbsp;2 Nummer&nbsp;2 TDDDG).
        Auf einem öffentlichen Computer können Sie bei der Anmeldung wählen, dass beim Abmelden
        alles aus dem Browser gelöscht wird.
      </p>

      <h3>Wiederherstellung</h3>
      <p>
        Ein neues Gerät erhält Ihre Schlüssel über ein Gerät, das Sie schon nutzen, über einen
        Passkey oder über die Notfallkarte, die die App beim Einrichten ausgibt. Gehen alle drei
        verloren, können wir Ihre verschlüsselten Inhalte nicht wiederherstellen, weil wir keine
        Kopie Ihrer Schlüssel besitzen. Konto, Stundenplan und Kurswahl bleiben erhalten.
      </p>

      <h3>Übernahme aus dem Stundenplansystem</h3>
      <p>
        Klassen, Kurse, Stundenpläne und Vertretungen werden aus dem Stundenplansystem der Schule
        übernommen, etwa WebUntis. Die Schule entscheidet über diese Übermittlung und über ihren
        Umfang.
      </p>

      <h3>Technische Protokolle</h3>
      <p>
        Damit wir Fehler und Leistungsprobleme erkennen, protokolliert unser Server technische
        Abläufe. Diese Protokolle enthalten Kennungen und Zeitpunkte, aber keine Inhalte Ihrer
        Einträge: Diese erreichen den Server nur verschlüsselt.
      </p>

      <h3>Minderjährige</h3>
      <p>
        Die App richtet sich an Schülerinnen und Schüler und wird überwiegend von Minderjährigen
        genutzt. Die Verarbeitung erfolgt nicht auf Grundlage einer Einwilligung der Nutzenden,
        sondern für den von der Schule bereitgestellten Zugang und in ihrem Auftrag. Die Schule gibt
        ausschließlich unpersönliche Zugangscodes aus; die nutzende Person entscheidet selbst,
        welche zulässigen Konto- und Schuldaten sie verwendet. Unterschriften, die die Kenntnisnahme
        der Eltern belegen, bildet die App als solche ab.
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
            <strong>{processor.name}</strong>, {processor.address}: {processor.purpose}.
            Verarbeitung in: {processor.location}.
          </li>
        ))}
      </ul>
      <p>
        Unsere Server stehen bei einem deutschen Anbieter in Deutschland. Fotos, Unterschriften und
        Datensicherungen speichern wir bei Cloudflare in Rechenzentren in der Europäischen Union,
        und zwar nur verschlüsselt: Fotos und Unterschriften Ende-zu-Ende, Datensicherungen mit
        einem Schlüssel, den nur unser Server kennt. Cloudflare, Inc. hat seinen Sitz in den USA;
        ein Zugriff von dort ist rechtlich nicht auszuschließen. Grundlage dafür ist der
        Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework, unter dem
        Cloudflare zertifiziert ist.
      </p>

      <h2>5. Speicherdauer</h2>
      <p>
        Schuldaten werden gespeichert, solange die Schule die App einsetzt, und nach Beendigung nach
        ihren Weisungen gelöscht oder zurückgegeben. Daten auf dem Gerät werden mit der
        Deinstallation der App oder dem Löschen der Websitedaten im Browser entfernt. Gesetzliche
        Aufbewahrungspflichten, etwa aus Handels- und Steuerrecht, bleiben unberührt.
      </p>
      <p>
        Konten und die zugehörigen Zugangsdaten speichern wir, solange das Konto besteht.
        Abgelaufene Sitzungen sowie Bestätigungs- und Wiederherstellungstoken werden gelöscht,
        sobald sie für ihren Sicherheitszweck nicht mehr benötigt werden. Die Löschung eines Kontos
        kann über die oben genannte E-Mail-Adresse verlangt werden. Datensicherungen bewahren wir
        bis zu 35&nbsp;Tage auf. Mit einem Konto löschen wir auch die Sicherungen seiner Schlüssel,
        sodass ältere Kopien verschlüsselter Inhalte danach von niemandem mehr geöffnet werden
        können.
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
        Verschlüsselte Inhalte können wir nicht lesen. Sie sehen sie vollständig in der App auf
        Ihren Geräten; über alle übrigen Daten geben wir Auskunft.
      </p>
      <p>
        Soweit eine Verarbeitung auf einer Einwilligung beruht, können Sie diese jederzeit mit
        Wirkung für die Zukunft widerrufen (Artikel&nbsp;7 Absatz&nbsp;3 DSGVO).
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
}
