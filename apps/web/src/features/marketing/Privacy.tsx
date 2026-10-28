import { useAtom } from "@effect/atom-react";

import { Site } from "#/domain-ui/Site.ts";
import { Blob } from "#/ui/Blob.tsx";
import { Scramble } from "#/ui/Scramble.tsx";

import { Demo } from "./Demo.ts";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Stands in for ciphertext: the same length as `text`, deterministic, so prerendering matches. */
const ciphertext = (text: string) =>
  Array.from(
    { length: text.length },
    (_, index) =>
      alphabet[
        (text.charCodeAt(index) * 31 + index * 17 + ((index * index) % 13)) % alphabet.length
      ],
  ).join("");

const entries = [
  { kind: "Note", text: "Deutsch: 13 Punkte, Erörterung" },
  { kind: "Fehltag", text: "12.10.: krank, Attest folgt" },
  { kind: "Hausaufgabe", text: "Mathe: S. 84, Nr. 3 bis 7" },
  { kind: "Unterschrift", text: "Mama, am 23.10." },
] as const;

const views = [
  { id: "device", label: "Auf deinem Handy" },
  { id: "server", label: "Auf unserem Server" },
] as const;

/**
 * The privacy pitch rests on end-to-end encryption, and it names what the server still sees
 * (D24, D42). The card flips the same entries between the device's view and the server's.
 */
export function Privacy() {
  const [view, setView] = useAtom(Demo.vaultView);

  return (
    <section className="section section-surface privacy" id={Site.sections.privacy}>
      <Blob
        className="privacy-blob"
        duration={29}
        offset={0.15}
        rotate={38}
        outline="twin"
        tone="blue"
      />
      <div className="container privacy-grid">
        <div className="privacy-text">
          <div className="section-heading">
            <h2>Verschlüsselt, bevor es dein Handy verlässt</h2>
            <p>
              Noten, Fehlzeiten, Hausaufgaben, Fotos und Unterschriften sind
              Ende-zu-Ende-verschlüsselt. Den Schlüssel haben nur deine Geräte. Bei uns kommt
              Zeichensalat an, und den können auch wir nicht lesen.
            </p>
          </div>
          <div className="privacy-visible">
            <h3>Was unser Server trotzdem sieht</h3>
            <p>Damit Stundenplan, Anmeldung und Abgleich funktionieren:</p>
            <ul>
              <li>deine E-Mail-Adresse</li>
              <li>welche Kurse du belegst</li>
              <li>wann sich deine Geräte melden</li>
              <li>ungefähr, wie viel du einträgst</li>
              <li>den Stundenplan deiner Schule, den wir dafür abrufen</li>
            </ul>
            <p>Der Server steht in Deutschland.</p>
          </div>
        </div>

        <div className="vault reveal" data-view={view}>
          <fieldset className="vault-switch">
            <legend className="visually-hidden">Ansicht</legend>
            {views.map((each) => (
              <button
                aria-pressed={view === each.id}
                className="vault-option press"
                key={each.id}
                onClick={() => setView(each.id)}
                type="button"
              >
                {each.label}
              </button>
            ))}
          </fieldset>
          <ul aria-live="polite" className="vault-entries">
            {entries.map((entry) => (
              <li className="vault-entry" key={entry.kind}>
                <span className="vault-kind">{view === "device" ? entry.kind : "Eintrag"}</span>
                <span className="vault-text">
                  <Scramble text={view === "device" ? entry.text : ciphertext(entry.text)} />
                </span>
              </li>
            ))}
          </ul>
          <p className="vault-key">
            {view === "device"
              ? "Schlüssel: auf deinen Geräten"
              : "Schlüssel: keiner. Lesen können das nur deine Geräte."}
          </p>
        </div>
      </div>
    </section>
  );
}
