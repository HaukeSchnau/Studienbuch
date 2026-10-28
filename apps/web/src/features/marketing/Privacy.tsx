import { Site } from "#/domain-ui/Site.ts";
import { Blob } from "#/ui/Blob.tsx";
import { Scramble } from "#/ui/Scramble.tsx";

import type { Demo } from "./Demo.ts";

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

// Benefits only: what the server still processes is in the FAQ and the Datenschutzerklärung,
// where a reader looking for it finds the whole list.
const benefits = [
  {
    icon: "M7 10.5V8a5 5 0 0 1 10 0v2.5M6 10.5h12a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7.5a1 1 0 0 1 1-1zM12 14.5v2",
    title: "Der Schlüssel bleibt bei dir",
    body: "Nur deine Geräte haben ihn, wir nicht.",
  },
  {
    icon: "M3.5 12S7 5.5 12 5.5 20.5 12 20.5 12 17 18.5 12 18.5 3.5 12 3.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM4 20 20 4",
    title: "Bei uns nur Zeichensalat",
    body: "So kommen diese Einträge auf unserem Server an, und so liegen sie dort.",
  },
  {
    icon: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
    title: "Server in Deutschland",
    body: "Unser Server steht bei einem deutschen Anbieter in Deutschland.",
  },
] as const;

const views = [
  { id: "device", label: "Dein Handy" },
  { id: "server", label: "Unser Server" },
] as const;

/**
 * The privacy pitch rests on end-to-end encryption (D24). The card flips the same entries between
 * the device's view and the server's.
 */
export function Privacy({ demo, dispatch }: { demo: Demo.State; dispatch: Demo.Dispatch }) {
  const view = demo.vaultView;

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
            <h2>Deine Noten liest nur du</h2>
            <p>
              Noten, Fehlzeiten, Hausaufgaben, Fotos und Unterschriften verschlüsselt dein Handy,
              bevor sie es verlassen. Lesen kannst du sie auf deinen Geräten. Wir können es nicht.
            </p>
          </div>
          <ul className="benefits">
            {benefits.map(({ icon, title, body }) => (
              <li className="benefit" key={title}>
                <svg aria-hidden className="benefit-icon" viewBox="0 0 24 24">
                  <path d={icon} />
                </svg>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="vault reveal" data-view={view}>
          <fieldset className="vault-switch">
            <legend className="visually-hidden">Ansicht</legend>
            {views.map((each) => (
              <button
                aria-pressed={view === each.id}
                className="vault-option press"
                key={each.id}
                onClick={() => dispatch({ kind: "view", view: each.id })}
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
