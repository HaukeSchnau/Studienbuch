import clsx from "clsx";
import type { Metadata } from "next";

import styles from "./datenschutz.module.css";

export const metadata: Metadata = {
  title: "Datenschutz | Studienbuch",
};

const Datenschutz = () => (
  <div
    className={clsx("mx-auto max-w-screen-md px-8 text-gray-700", styles.page)}
  >
    <h1>Datenschutzerklärung</h1>
    <h2>Präambel</h2>
    <p>
      Mit der folgenden Datenschutzerklärung möchten wir Sie darüber aufklären,
      welche Arten Ihrer personenbezogenen Daten (nachfolgend auch kurz als
      &quot;Daten&quot; bezeichnet) wir zu welchen Zwecken und in welchem Umfang
      im Rahmen der Bereitstellung unserer Applikation verarbeiten.
    </p>
    <p>Die verwendeten Begriffe sind nicht geschlechtsspezifisch.</p>
    <p>Stand: 16. Mai 2023</p>
    <h2>Inhaltsübersicht</h2>
    <ul className="index">
      <li>
        <a className="index-link" href="#m4158">
          Präambel
        </a>
      </li>
      <li>
        <a className="index-link" href="#m3">
          Verantwortlicher
        </a>
      </li>
      <li>
        <a className="index-link" href="#mOverview">
          Übersicht der Verarbeitungen
        </a>
      </li>
      <li>
        <a className="index-link" href="#m13">
          Maßgebliche Rechtsgrundlagen
        </a>
      </li>
      <li>
        <a className="index-link" href="#m27">
          Sicherheitsmaßnahmen
        </a>
      </li>
      <li>
        <a className="index-link" href="#m12">
          Löschung von Daten
        </a>
      </li>
      <li>
        <a className="index-link" href="#m317">
          Geschäftliche Leistungen
        </a>
      </li>
      <li>
        <a className="index-link" href="#m225">
          Bereitstellung des Onlineangebotes und Webhosting
        </a>
      </li>
      <li>
        <a className="index-link" href="#m1643">
          Push-Nachrichten
        </a>
      </li>
      <li>
        <a className="index-link" href="#m328">
          Plugins und eingebettete Funktionen sowie Inhalte
        </a>
      </li>
      <li>
        <a className="index-link" href="#m15">
          Änderung und Aktualisierung der Datenschutzerklärung
        </a>
      </li>
      <li>
        <a className="index-link" href="#m10">
          Rechte der betroffenen Personen
        </a>
      </li>
      <li>
        <a className="index-link" href="#m42">
          Begriffsdefinitionen
        </a>
      </li>
    </ul>
    <h2 id="m3">Verantwortlicher</h2>
    <p>
      Hauke Schnau
      <br />
      Stellinger Ch. 19
      <br />
      22529 Hamburg
    </p>
    E-Mail-Adresse:
    <p>hauke@stu-lilienthal.de</p>
    <h2 id="mOverview">Übersicht der Verarbeitungen</h2>
    <p>
      Die nachfolgende Übersicht fasst die Arten der verarbeiteten Daten und die
      Zwecke ihrer Verarbeitung zusammen und verweist auf die betroffenen
      Personen.
    </p>
    <h3>Arten der verarbeiteten Daten</h3>
    <ul>
      <li>Bestandsdaten.</li>
      <li>Zahlungsdaten.</li>
      <li>Kontaktdaten.</li>
      <li>Vertragsdaten.</li>
      <li>Nutzungsdaten.</li>
      <li>Meta-, Kommunikations- und Verfahrensdaten.</li>
    </ul>
    <h3>Kategorien betroffener Personen</h3>
    <ul>
      <li>Interessenten.</li>
      <li>Kommunikationspartner.</li>
      <li>Nutzer.</li>
      <li>Geschäfts- und Vertragspartner.</li>
    </ul>
    <h3>Zwecke der Verarbeitung</h3>
    <ul>
      <li>Erbringung vertraglicher Leistungen und Kundenservice.</li>
      <li>Kontaktanfragen und Kommunikation.</li>
      <li>Sicherheitsmaßnahmen.</li>
      <li>Büro- und Organisationsverfahren.</li>
      <li>Verwaltung und Beantwortung von Anfragen.</li>
      <li>Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit.</li>
      <li>Informationstechnische Infrastruktur.</li>
    </ul>
    <h3 id="m13">Maßgebliche Rechtsgrundlagen</h3>
    <p>
      Im Folgenden erhalten Sie eine Übersicht der Rechtsgrundlagen der DSGVO,
      auf deren Basis wir personenbezogene Daten verarbeiten. Bitte nehmen Sie
      zur Kenntnis, dass neben den Regelungen der DSGVO nationale
      Datenschutzvorgaben in Ihrem bzw. unserem Wohn- oder Sitzland gelten
      können. Sollten ferner im Einzelfall speziellere Rechtsgrundlagen
      maßgeblich sein, teilen wir Ihnen diese in der Datenschutzerklärung mit.
    </p>
    <ul>
      <li>
        <strong>Einwilligung (Art. 6 Abs. 1 S. 1 lit. a) DSGVO)</strong> - Die
        betroffene Person hat ihre Einwilligung in die Verarbeitung der sie
        betreffenden personenbezogenen Daten für einen spezifischen Zweck oder
        mehrere bestimmte Zwecke gegeben.
      </li>
      <li>
        <strong>
          Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1
          lit. b) DSGVO)
        </strong>
        - Die Verarbeitung ist für die Erfüllung eines Vertrags, dessen
        Vertragspartei die betroffene Person ist, oder zur Durchführung
        vorvertraglicher Maßnahmen erforderlich, die auf Anfrage der betroffenen
        Person erfolgen.
      </li>
      <li>
        <strong>
          Rechtliche Verpflichtung (Art. 6 Abs. 1 S. 1 lit. c) DSGVO)
        </strong>
        - Die Verarbeitung ist zur Erfüllung einer rechtlichen Verpflichtung
        erforderlich, der der Verantwortliche unterliegt.
      </li>
      <li>
        <strong>
          Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO)
        </strong>{" "}
        - Die Verarbeitung ist zur Wahrung der berechtigten Interessen des
        Verantwortlichen oder eines Dritten erforderlich, sofern nicht die
        Interessen oder Grundrechte und Grundfreiheiten der betroffenen Person,
        die den Schutz personenbezogener Daten erfordern, überwiegen.
      </li>
    </ul>
    <p>
      Zusätzlich zu den Datenschutzregelungen der DSGVO gelten nationale
      Regelungen zum Datenschutz in Deutschland. Hierzu gehört insbesondere das
      Gesetz zum Schutz vor Missbrauch personenbezogener Daten bei der
      Datenverarbeitung (Bundesdatenschutzgesetz – BDSG). Das BDSG enthält
      insbesondere Spezialregelungen zum Recht auf Auskunft, zum Recht auf
      Löschung, zum Widerspruchsrecht, zur Verarbeitung besonderer Kategorien
      personenbezogener Daten, zur Verarbeitung für andere Zwecke und zur
      Übermittlung sowie automatisierten Entscheidungsfindung im Einzelfall
      einschließlich Profiling. Des Weiteren regelt es die Datenverarbeitung für
      Zwecke des Beschäftigungsverhältnisses (§ 26 BDSG), insbesondere im
      Hinblick auf die Begründung, Durchführung oder Beendigung von
      Beschäftigungsverhältnissen sowie die Einwilligung von Beschäftigten.
      Ferner können Landesdatenschutzgesetze der einzelnen Bundesländer zur
      Anwendung gelangen.
    </p>
    <h2 id="m27">Sicherheitsmaßnahmen</h2>
    <p>
      Wir treffen nach Maßgabe der gesetzlichen Vorgaben unter Berücksichtigung
      des Stands der Technik, der Implementierungskosten und der Art, des
      Umfangs, der Umstände und der Zwecke der Verarbeitung sowie der
      unterschiedlichen Eintrittswahrscheinlichkeiten und des Ausmaßes der
      Bedrohung der Rechte und Freiheiten natürlicher Personen geeignete
      technische und organisatorische Maßnahmen, um ein dem Risiko angemessenes
      Schutzniveau zu gewährleisten.
    </p>
    <p>
      Zu den Maßnahmen gehören insbesondere die Sicherung der Vertraulichkeit,
      Integrität und Verfügbarkeit von Daten durch Kontrolle des physischen und
      elektronischen Zugangs zu den Daten als auch des sie betreffenden
      Zugriffs, der Eingabe, der Weitergabe, der Sicherung der Verfügbarkeit und
      ihrer Trennung. Des Weiteren haben wir Verfahren eingerichtet, die eine
      Wahrnehmung von Betroffenenrechten, die Löschung von Daten und Reaktionen
      auf die Gefährdung der Daten gewährleisten. Ferner berücksichtigen wir den
      Schutz personenbezogener Daten bereits bei der Entwicklung bzw. Auswahl
      von Hardware, Software sowie Verfahren entsprechend dem Prinzip des
      Datenschutzes, durch Technikgestaltung und durch datenschutzfreundliche
      Voreinstellungen.
    </p>
    <p>
      TLS-Verschlüsselung (https): Um Ihre via unserem Online-Angebot
      übermittelten Daten zu schützen, nutzen wir eine TLS-Verschlüsselung. Sie
      erkennen derart verschlüsselte Verbindungen an dem Präfix https:// in der
      Adresszeile Ihres Browsers.
    </p>
    <h2 id="m12">Löschung von Daten</h2>
    <p>
      Die von uns verarbeiteten Daten werden nach Maßgabe der gesetzlichen
      Vorgaben gelöscht, sobald deren zur Verarbeitung erlaubten Einwilligungen
      widerrufen werden oder sonstige Erlaubnisse entfallen (z.B. wenn der Zweck
      der Verarbeitung dieser Daten entfallen ist oder sie für den Zweck nicht
      erforderlich sind). Sofern die Daten nicht gelöscht werden, weil sie für
      andere und gesetzlich zulässige Zwecke erforderlich sind, wird deren
      Verarbeitung auf diese Zwecke beschränkt. D.h., die Daten werden gesperrt
      und nicht für andere Zwecke verarbeitet. Das gilt z.B. für Daten, die aus
      handels- oder steuerrechtlichen Gründen aufbewahrt werden müssen oder
      deren Speicherung zur Geltendmachung, Ausübung oder Verteidigung von
      Rechtsansprüchen oder zum Schutz der Rechte einer anderen natürlichen oder
      juristischen Person erforderlich ist.
    </p>
    <p>
      Unsere Datenschutzhinweise können ferner weitere Angaben zu der
      Aufbewahrung und Löschung von Daten beinhalten, die für die jeweiligen
      Verarbeitungen vorrangig gelten.
    </p>
    <h2 id="m317">Geschäftliche Leistungen</h2>
    <p>
      Wir verarbeiten Daten unserer Vertrags- und Geschäftspartner, z.B. Kunden
      und Interessenten (zusammenfassend bezeichnet als
      &quot;Vertragspartner&quot;) im Rahmen von vertraglichen und
      vergleichbaren Rechtsverhältnissen sowie damit verbundenen Maßnahmen und
      im Rahmen der Kommunikation mit den Vertragspartnern (oder
      vorvertraglich), z.B., um Anfragen zu beantworten.
    </p>
    <p>
      Wir verarbeiten diese Daten, um unsere vertraglichen Verpflichtungen zu
      erfüllen. Dazu gehören insbesondere die Verpflichtungen zur Erbringung der
      vereinbarten Leistungen, etwaige Aktualisierungspflichten und Abhilfe bei
      Gewährleistungs- und sonstigen Leistungsstörungen. Darüber hinaus
      verarbeiten wir die Daten zur Wahrung unserer Rechte und zum Zwecke der
      mit diesen Pflichten verbundenen Verwaltungsaufgaben sowie der
      Unternehmensorganisation. Darüber hinaus verarbeiten wir die Daten auf
      Grundlage unserer berechtigten Interessen an einer ordnungsgemäßen und
      betriebswirtschaftlichen Geschäftsführung sowie an Sicherheitsmaßnahmen
      zum Schutz unserer Vertragspartner und unseres Geschäftsbetriebes vor
      Missbrauch, Gefährdung ihrer Daten, Geheimnisse, Informationen und Rechte
      (z.B. zur Beteiligung von Telekommunikations-, Transport- und sonstigen
      Hilfsdiensten sowie Subunternehmern, Banken, Steuer- und Rechtsberatern,
      Zahlungsdienstleistern oder Finanzbehörden). Im Rahmen des geltenden
      Rechts geben wir die Daten von Vertragspartnern nur insoweit an Dritte
      weiter, als dies für die vorgenannten Zwecke oder zur Erfüllung
      gesetzlicher Pflichten erforderlich ist. Über weitere Formen der
      Verarbeitung, z.B. zu Marketingzwecken, werden die Vertragspartner im
      Rahmen dieser Datenschutzerklärung informiert.
    </p>
    <p>
      Welche Daten für die vorgenannten Zwecke erforderlich sind, teilen wir den
      Vertragspartnern vor oder im Rahmen der Datenerhebung, z.B. in
      Onlineformularen, durch besondere Kennzeichnung (z.B. Farben) bzw. Symbole
      (z.B. Sternchen o.ä.), oder persönlich mit.
    </p>
    <p>
      Wir löschen die Daten nach Ablauf gesetzlicher Gewährleistungs- und
      vergleichbarer Pflichten, d.h., grundsätzlich nach Ablauf von 4 Jahren, es
      sei denn, dass die Daten in einem Kundenkonto gespeichert werden, z.B.,
      solange sie aus gesetzlichen Gründen der Archivierung aufbewahrt werden
      müssen. Die gesetzliche Aufbewahrungsfrist beträgt bei steuerrechtlich
      relevanten Unterlagen sowie bei Handelsbüchern, Inventaren,
      Eröffnungsbilanzen, Jahresabschlüssen, die zum Verständnis dieser
      Unterlagen erforderlichen Arbeitsanweisungen und sonstigen
      Organisationsunterlagen und Buchungsbelegen zehn Jahre sowie bei
      empfangenen Handels- und Geschäftsbriefen und Wiedergaben der abgesandten
      Handels- und Geschäftsbriefe sechs Jahre. Die Frist beginnt mit Ablauf des
      Kalenderjahres, in dem die letzte Eintragung in das Buch gemacht, das
      Inventar, die Eröffnungsbilanz, der Jahresabschluss oder der Lagebericht
      aufgestellt, der Handels- oder Geschäftsbrief empfangen oder abgesandt
      worden oder der Buchungsbeleg entstanden ist, ferner die Aufzeichnung
      vorgenommen worden ist oder die sonstigen Unterlagen entstanden sind.
    </p>
    <p>
      Soweit wir zur Erbringung unserer Leistungen Drittanbieter oder
      Plattformen einsetzen, gelten im Verhältnis zwischen den Nutzern und den
      Anbietern die Geschäftsbedingungen und Datenschutzhinweise der jeweiligen
      Drittanbieter oder Plattformen.
    </p>
    <ul className="m-elements">
      <li>
        <strong>Verarbeitete Datenarten:</strong> Bestandsdaten (z.B. Namen,
        Adressen); Zahlungsdaten (z.B. Bankverbindungen, Rechnungen,
        Zahlungshistorie); Kontaktdaten (z.B. E-Mail, Telefonnummern);
        Vertragsdaten (z.B. Vertragsgegenstand, Laufzeit, Kundenkategorie).
      </li>
      <li>
        <strong>Betroffene Personen:</strong> Interessenten; Geschäfts- und
        Vertragspartner.
      </li>
      <li>
        <strong>Zwecke der Verarbeitung:</strong> Erbringung vertraglicher
        Leistungen und Kundenservice; Kontaktanfragen und Kommunikation; Büro-
        und Organisationsverfahren; Verwaltung und Beantwortung von Anfragen.
      </li>
      <li>
        <strong>Rechtsgrundlagen:</strong> Vertragserfüllung und vorvertragliche
        Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO); Rechtliche Verpflichtung
        (Art. 6 Abs. 1 S. 1 lit. c) DSGVO); Berechtigte Interessen (Art. 6 Abs.
        1 S. 1 lit. f) DSGVO).
      </li>
    </ul>
    <h2 id="m225">Bereitstellung des Onlineangebotes und Webhosting</h2>
    <p>
      Wir verarbeiten die Daten der Nutzer, um ihnen unsere Online-Dienste zur
      Verfügung stellen zu können. Zu diesem Zweck verarbeiten wir die
      IP-Adresse des Nutzers, die notwendig ist, um die Inhalte und Funktionen
      unserer Online-Dienste an den Browser oder das Endgerät der Nutzer zu
      übermitteln.
    </p>
    <ul className="m-elements">
      <li>
        <strong>Verarbeitete Datenarten:</strong> Nutzungsdaten (z.B. besuchte
        Webseiten, Interesse an Inhalten, Zugriffszeiten); Meta-,
        Kommunikations- und Verfahrensdaten (z. B. IP-Adressen, Zeitangaben,
        Identifikationsnummern, Einwilligungsstatus).
      </li>
      <li>
        <strong>Betroffene Personen:</strong> Nutzer (z.B. Webseitenbesucher,
        Nutzer von Onlinediensten).
      </li>
      <li>
        <strong>Zwecke der Verarbeitung:</strong> Bereitstellung unseres
        Onlineangebotes und Nutzerfreundlichkeit; Informationstechnische
        Infrastruktur (Betrieb und Bereitstellung von Informationssystemen und
        technischen Geräten (Computer, Server etc.).); Sicherheitsmaßnahmen.
      </li>
      <li>
        <strong>Rechtsgrundlagen:</strong> Berechtigte Interessen (Art. 6 Abs. 1
        S. 1 lit. f) DSGVO).
      </li>
    </ul>
    <p>
      <strong>
        Weitere Hinweise zu Verarbeitungsprozessen, Verfahren und Diensten:
      </strong>
    </p>
    <ul className="m-elements">
      <li>
        <strong>
          Bereitstellung Onlineangebot auf gemietetem Speicherplatz:{" "}
        </strong>
        Für die Bereitstellung unseres Onlineangebotes nutzen wir Speicherplatz,
        Rechenkapazität und Software, die wir von einem entsprechenden
        Serveranbieter (auch &quot;Webhoster&quot; genannt) mieten oder
        anderweitig beziehen;
        <strong>Rechtsgrundlagen:</strong> Berechtigte Interessen (Art. 6 Abs. 1
        S. 1 lit. f) DSGVO).
      </li>
      <li>
        <strong>Erhebung von Zugriffsdaten und Logfiles: </strong>Der Zugriff
        auf unser Onlineangebot wird in Form von so genannten
        &quot;Server-Logfiles&quot; protokolliert. Zu den Serverlogfiles können
        die Adresse und Name der abgerufenen Webseiten und Dateien, Datum und
        Uhrzeit des Abrufs, übertragene Datenmengen, Meldung über erfolgreichen
        Abruf, Browsertyp nebst Version, das Betriebssystem des Nutzers,
        Referrer URL (die zuvor besuchte Seite) und im Regelfall IP-Adressen und
        der anfragende Provider gehören. Die Serverlogfiles können zum einen zu
        Zwecken der Sicherheit eingesetzt werden, z.B., um eine Überlastung der
        Server zu vermeiden (insbesondere im Fall von missbräuchlichen
        Angriffen, sogenannten DDoS-Attacken) und zum anderen, um die Auslastung
        der Server und ihre Stabilität sicherzustellen;
        <strong>Rechtsgrundlagen:</strong> Berechtigte Interessen (Art. 6 Abs. 1
        S. 1 lit. f) DSGVO); <strong>Löschung von Daten:</strong>{" "}
        Logfile-Informationen werden für die Dauer von maximal 30 Tagen
        gespeichert und danach gelöscht oder anonymisiert. Daten, deren weitere
        Aufbewahrung zu Beweiszwecken erforderlich ist, sind bis zur endgültigen
        Klärung des jeweiligen Vorfalls von der Löschung ausgenommen.
      </li>
      <li>
        <strong>STRATO: </strong>Leistungen auf dem Gebiet der Bereitstellung
        von informationstechnischer Infrastruktur und verbundenen
        Dienstleistungen (z.B. Speicherplatz und/oder Rechenkapazitäten);
        <strong>Dienstanbieter:</strong> STRATO AG, Pascalstraße 10,10587
        Berlin, Deutschland; <strong>Rechtsgrundlagen:</strong> Berechtigte
        Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO); <strong>Website:</strong>
        <a href="https://www.strato.de" target="_blank" rel="noreferrer">
          https://www.strato.de
        </a>
        ;<strong>Datenschutzerklärung:</strong>
        <a
          href="https://www.strato.de/datenschutz"
          target="_blank"
          rel="noreferrer"
        >
          https://www.strato.de/datenschutz
        </a>
        ; <strong>Auftragsverarbeitungsvertrag:</strong> Wird vom Dienstanbieter
        bereitgestellt.
      </li>
    </ul>
    <h2 id="m1643">Push-Nachrichten</h2>
    <p>
      Mit der Zustimmung der Nutzer, können wir den Nutzern so genannte
      &quot;Push-Benachrichtigungen&quot; zusenden. Dabei handelt es sich um
      Nachrichten, die auf den Bildschirmen, Endgeräten oder in Browsern der
      Nutzer angezeigt werden, auch wenn unser Onlinedienst gerade nicht aktiv
      genutzt wird.
    </p>
    <p>
      Um sich für die Push-Nachrichten anzumelden, müssen Nutzer die Abfrage
      ihres Browsers bzw. Endgerätes zum Erhalt der Push-Nachrichten bestätigen.
      Dieser Zustimmungsprozess wird dokumentiert und gespeichert. Die
      Speicherung ist erforderlich, um zu erkennen, ob Nutzer dem Empfang der
      Push-Nachrichten zugestimmt haben sowie um die Zustimmung nachweisen zu
      können. Zu diesen Zwecken wird ein pseudonymer Identifikator des Browsers
      (sog. &quot;Push-Token&quot;) oder die Geräte-ID eines Endgerätes
      gespeichert.
    </p>
    <p>
      Die Push-Nachrichten können zum einen für die Erfüllung von vertraglichen
      Pflichten erforderlich sein (z. B. für die Nutzung unseres Onlineangebotes
      relevante technische und organisatorische Informationen)
    </p>
    Inhalte:
    <p>Tagesaktuelle Änderungen im Vertretungsplan</p>
    <p>Kommende Klausuren</p>
    <p>Erinnerungen für Hausaufgaben</p>
    <ul className="m-elements">
      <li>
        <strong>Betroffene Personen:</strong> Kommunikationspartner.
      </li>
      <li>
        <strong>Zwecke der Verarbeitung:</strong> Bereitstellung unseres
        Onlineangebotes und Nutzerfreundlichkeit.
      </li>
      <li>
        <strong>Rechtsgrundlagen:</strong> Einwilligung (Art. 6 Abs. 1 S. 1 lit.
        a) DSGVO); Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1
        S. 1 lit. b) DSGVO).
      </li>
    </ul>
    <h2 id="m328">Plugins und eingebettete Funktionen sowie Inhalte</h2>
    <p>
      Wir binden in unser Onlineangebot Funktions- und Inhaltselemente ein, die
      von den Servern ihrer jeweiligen Anbieter (nachfolgend bezeichnet als
      &quot;Drittanbieter&quot;) bezogen werden. Dabei kann es sich zum Beispiel
      um Grafiken, Videos oder Stadtpläne handeln (nachfolgend einheitlich
      bezeichnet als &quot;Inhalte&quot;).
    </p>
    <p>
      Die Einbindung setzt immer voraus, dass die Drittanbieter dieser Inhalte
      die IP-Adresse der Nutzer verarbeiten, da sie ohne die IP-Adresse die
      Inhalte nicht an deren Browser senden könnten. Die IP-Adresse ist damit
      für die Darstellung dieser Inhalte oder Funktionen erforderlich. Wir
      bemühen uns, nur solche Inhalte zu verwenden, deren jeweilige Anbieter die
      IP-Adresse lediglich zur Auslieferung der Inhalte verwenden. Drittanbieter
      können ferner sogenannte Pixel-Tags (unsichtbare Grafiken, auch als
      &quot;Web Beacons&quot; bezeichnet) für statistische oder Marketingzwecke
      verwenden. Durch die &quot;Pixel-Tags&quot; können Informationen, wie der
      Besucherverkehr auf den Seiten dieser Webseite, ausgewertet werden. Die
      pseudonymen Informationen können ferner in Cookies auf dem Gerät der
      Nutzer gespeichert werden und unter anderem technische Informationen zum
      Browser und zum Betriebssystem, zu verweisenden Webseiten, zur Besuchszeit
      sowie weitere Angaben zur Nutzung unseres Onlineangebotes enthalten als
      auch mit solchen Informationen aus anderen Quellen verbunden werden.
    </p>
    <ul className="m-elements">
      <li>
        <strong>Verarbeitete Datenarten:</strong> Nutzungsdaten (z.B. besuchte
        Webseiten, Interesse an Inhalten, Zugriffszeiten); Meta-,
        Kommunikations- und Verfahrensdaten (z. B. IP-Adressen, Zeitangaben,
        Identifikationsnummern, Einwilligungsstatus).
      </li>
      <li>
        <strong>Betroffene Personen:</strong> Nutzer (z.B. Webseitenbesucher,
        Nutzer von Onlinediensten).
      </li>
      <li>
        <strong>Zwecke der Verarbeitung:</strong> Bereitstellung unseres
        Onlineangebotes und Nutzerfreundlichkeit.
      </li>
      <li>
        <strong>Rechtsgrundlagen:</strong> Berechtigte Interessen (Art. 6 Abs. 1
        S. 1 lit. f) DSGVO).
      </li>
    </ul>
    <p>
      <strong>
        Weitere Hinweise zu Verarbeitungsprozessen, Verfahren und Diensten:
      </strong>
    </p>
    <ul className="m-elements">
      <li>
        <strong>Google Fonts (Bezug vom Google Server): </strong>Bezug von
        Schriften (und Symbolen) zum Zwecke einer technisch sicheren,
        wartungsfreien und effizienten Nutzung von Schriften und Symbolen im
        Hinblick auf Aktualität und Ladezeiten, deren einheitliche Darstellung
        und Berücksichtigung möglicher lizenzrechtlicher Beschränkungen. Dem
        Anbieter der Schriftarten wird die IP-Adresse des Nutzers mitgeteilt,
        damit die Schriftarten im Browser des Nutzers zur Verfügung gestellt
        werden können. Darüber hinaus werden technische Daten
        (Spracheinstellungen, Bildschirmauflösung, Betriebssystem, verwendete
        Hardware) übermittelt, die für die Bereitstellung der Schriften in
        Abhängigkeit von den verwendeten Geräten und der technischen Umgebung
        notwendig sind. Diese Daten können auf einem Server des Anbieters der
        Schriftarten in den USA verarbeitet werden - Beim Besuch unseres
        Onlineangebotes senden die Browser der Nutzer ihre Browser HTTP-Anfragen
        an die Google Fonts Web API (d.h. eine Softwareschnittstelle für den
        Abruf der Schriftarten). Die Google Fonts Web API stellt den Nutzern die
        Cascading Style Sheets (CSS) von Google Fonts und danach die in der CCS
        angegebenen Schriftarten zur Verfügung. Zu diesen HTTP-Anfragen gehören
        (1) die vom jeweiligen Nutzer für den Zugriff auf das Internet
        verwendete IP-Adresse, (2) die angeforderte URL auf dem Google-Server
        und (3) die HTTP-Header, einschließlich des User-Agents, der die
        Browser- und Betriebssystemversionen der Websitebesucher beschreibt,
        sowie die Verweis-URL (d.h. die Webseite, auf der die Google-Schriftart
        angezeigt werden soll). IP-Adressen werden weder auf Google-Servern
        protokolliert noch gespeichert und sie werden nicht analysiert. Die
        Google Fonts Web API protokolliert Details der HTTP-Anfragen
        (angeforderte URL, User-Agent und Verweis-URL). Der Zugriff auf diese
        Daten ist eingeschränkt und streng kontrolliert. Die angeforderte URL
        identifiziert die Schriftfamilien, für die der Nutzer Schriftarten laden
        möchte. Diese Daten werden protokolliert, damit Google bestimmen kann,
        wie oft eine bestimmte Schriftfamilie angefordert wird. Bei der Google
        Fonts Web API muss der User-Agent die Schriftart anpassen, die für den
        jeweiligen Browsertyp generiert wird. Der User-Agent wird in erster
        Linie zum Debugging protokolliert und verwendet, um aggregierte
        Nutzungsstatistiken zu generieren, mit denen die Beliebtheit von
        Schriftfamilien gemessen wird. Diese zusammengefassten
        Nutzungsstatistiken werden auf der Seite „Analysen“ von Google Fonts
        veröffentlicht. Schließlich wird die Verweis-URL protokolliert, sodass
        die Daten für die Wartung der Produktion verwendet und ein aggregierter
        Bericht zu den Top-Integrationen basierend auf der Anzahl der
        Schriftartenanfragen generiert werden kann. Google verwendet laut
        eigener Auskunft keine der von Google Fonts erfassten Informationen, um
        Profile von Endnutzern zu erstellen oder zielgerichtete Anzeigen zu
        schalten;
        <strong>Dienstanbieter:</strong> Google Ireland Limited, Gordon House,
        Barrow Street, Dublin 4, Irland;
        <strong>Rechtsgrundlagen:</strong> Berechtigte Interessen (Art. 6 Abs. 1
        S. 1 lit. f) DSGVO); <strong>Website:</strong>
        <a href="https://fonts.google.com/" target="_blank" rel="noreferrer">
          https://fonts.google.com/
        </a>
        ; <strong>Datenschutzerklärung:</strong>
        <a
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noreferrer"
        >
          https://policies.google.com/privacy
        </a>
        ; <strong>Weitere Informationen:</strong>
        <a
          href="https://developers.google.com/fonts/faq/privacy?hl=de"
          target="_blank"
          rel="noreferrer"
        >
          https://developers.google.com/fonts/faq/privacy?hl=de
        </a>
        .
      </li>
    </ul>
    <h2 id="m15">Änderung und Aktualisierung der Datenschutzerklärung</h2>
    <p>
      Wir bitten Sie, sich regelmäßig über den Inhalt unserer
      Datenschutzerklärung zu informieren. Wir passen die Datenschutzerklärung
      an, sobald die Änderungen der von uns durchgeführten Datenverarbeitungen
      dies erforderlich machen. Wir informieren Sie, sobald durch die Änderungen
      eine Mitwirkungshandlung Ihrerseits (z.B. Einwilligung) oder eine sonstige
      individuelle Benachrichtigung erforderlich wird.
    </p>
    <p>
      Sofern wir in dieser Datenschutzerklärung Adressen und
      Kontaktinformationen von Unternehmen und Organisationen angeben, bitten
      wir zu beachten, dass die Adressen sich über die Zeit ändern können und
      bitten die Angaben vor Kontaktaufnahme zu prüfen.
    </p>
    <h2 id="m10">Rechte der betroffenen Personen</h2>
    <p>
      Ihnen stehen als Betroffene nach der DSGVO verschiedene Rechte zu, die
      sich insbesondere aus Art. 15 bis 21 DSGVO ergeben:
    </p>
    <ul>
      <li>
        <strong>
          Widerspruchsrecht: Sie haben das Recht, aus Gründen, die sich aus
          Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung
          der Sie betreffenden personenbezogenen Daten, die aufgrund von Art. 6
          Abs. 1 lit. e oder f DSGVO erfolgt, Widerspruch einzulegen; dies gilt
          auch für ein auf diese Bestimmungen gestütztes Profiling. Werden die
          Sie betreffenden personenbezogenen Daten verarbeitet, um Direktwerbung
          zu betreiben, haben Sie das Recht, jederzeit Widerspruch gegen die
          Verarbeitung der Sie betreffenden personenbezogenen Daten zum Zwecke
          derartiger Werbung einzulegen; dies gilt auch für das Profiling,
          soweit es mit solcher Direktwerbung in Verbindung steht.
        </strong>
      </li>
      <li>
        <strong>Widerrufsrecht bei Einwilligungen:</strong> Sie haben das Recht,
        erteilte Einwilligungen jederzeit zu widerrufen.
      </li>
      <li>
        <strong>Auskunftsrecht:</strong> Sie haben das Recht, eine Bestätigung
        darüber zu verlangen, ob betreffende Daten verarbeitet werden und auf
        Auskunft über diese Daten sowie auf weitere Informationen und Kopie der
        Daten entsprechend den gesetzlichen Vorgaben.
      </li>
      <li>
        <strong>Recht auf Berichtigung:</strong> Sie haben entsprechend den
        gesetzlichen Vorgaben das Recht, die Vervollständigung der Sie
        betreffenden Daten oder die Berichtigung der Sie betreffenden
        unrichtigen Daten zu verlangen.
      </li>
      <li>
        <strong>Recht auf Löschung und Einschränkung der Verarbeitung:</strong>{" "}
        Sie haben nach Maßgabe der gesetzlichen Vorgaben das Recht, zu
        verlangen, dass Sie betreffende Daten unverzüglich gelöscht werden, bzw.
        alternativ nach Maßgabe der gesetzlichen Vorgaben eine Einschränkung der
        Verarbeitung der Daten zu verlangen.
      </li>
      <li>
        <strong>Recht auf Datenübertragbarkeit:</strong> Sie haben das Recht,
        Sie betreffende Daten, die Sie uns bereitgestellt haben, nach Maßgabe
        der gesetzlichen Vorgaben in einem strukturierten, gängigen und
        maschinenlesbaren Format zu erhalten oder deren Übermittlung an einen
        anderen Verantwortlichen zu fordern.
      </li>
      <li>
        <strong>Beschwerde bei Aufsichtsbehörde:</strong> Sie haben unbeschadet
        eines anderweitigen verwaltungsrechtlichen oder gerichtlichen
        Rechtsbehelfs das Recht auf Beschwerde bei einer Aufsichtsbehörde,
        insbesondere in dem Mitgliedstaat ihres gewöhnlichen Aufenthaltsorts,
        ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes, wenn Sie
        der Ansicht sind, dass die Verarbeitung der Sie betreffenden
        personenbezogenen Daten gegen die Vorgaben der DSGVO verstößt.
      </li>
    </ul>
    <h2 id="m42">Begriffsdefinitionen</h2>
    <p>
      In diesem Abschnitt erhalten Sie eine Übersicht über die in dieser
      Datenschutzerklärung verwendeten Begrifflichkeiten. Viele der Begriffe
      sind dem Gesetz entnommen und vor allem im Art. 4 DSGVO definiert. Die
      gesetzlichen Definitionen sind verbindlich. Die nachfolgenden
      Erläuterungen sollen dagegen vor allem dem Verständnis dienen. Die
      Begriffe sind alphabetisch sortiert.
    </p>
    <ul className="glossary">
      <li>
        <strong>Personenbezogene Daten:</strong> &quot;Personenbezogene
        Daten&quot; sind alle Informationen, die sich auf eine identifizierte
        oder identifizierbare natürliche Person (im Folgenden &quot;betroffene
        Person&quot;) beziehen; als identifizierbar wird eine natürliche Person
        angesehen, die direkt oder indirekt, insbesondere mittels Zuordnung zu
        einer Kennung wie einem Namen, zu einer Kennnummer, zu Standortdaten, zu
        einer Online-Kennung (z.B. Cookie) oder zu einem oder mehreren
        besonderen Merkmalen identifiziert werden kann, die Ausdruck der
        physischen, physiologischen, genetischen, psychischen, wirtschaftlichen,
        kulturellen oder sozialen Identität dieser natürlichen Person sind.
      </li>
      <li>
        <strong>Verantwortlicher:</strong> Als &quot;Verantwortlicher&quot; wird
        die natürliche oder juristische Person, Behörde, Einrichtung oder andere
        Stelle, die allein oder gemeinsam mit anderen über die Zwecke und Mittel
        der Verarbeitung von personenbezogenen Daten entscheidet, bezeichnet.
      </li>
      <li>
        <strong>Verarbeitung:</strong> &quot;Verarbeitung&quot; ist jeder mit
        oder ohne Hilfe automatisierter Verfahren ausgeführte Vorgang oder jede
        solche Vorgangsreihe im Zusammenhang mit personenbezogenen Daten. Der
        Begriff reicht weit und umfasst praktisch jeden Umgang mit Daten, sei es
        das Erheben, das Auswerten, das Speichern, das Übermitteln oder das
        Löschen.
      </li>
    </ul>
  </div>
);

export default Datenschutz;
