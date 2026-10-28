// oxlint-disable-next-line studienbuch/no-em-dash-copy -- fixture: an em dash in a string
export const label = "Stand — heute";

export const detail = (count: number) =>
  // oxlint-disable-next-line studienbuch/no-em-dash-copy -- fixture: an em dash in a template
  `${count} Stunden — Vertretung`;

export function Footer() {
  return (
    <footer>
      {/* oxlint-disable-next-line studienbuch/no-em-dash-copy -- fixture: an em dash in JSX text */}
      <p>Studienbuch — dein Schulplaner</p>
      {/* oxlint-disable-next-line studienbuch/no-native-title-tooltip -- fixture: a hint only a mouse sees */}
      <span title="Zuletzt aktualisiert">Stand</span>
      <iframe title="Stundenplan" src="/plan" sandbox="" />
    </footer>
  );
}

// Hyphens and en dashes pass, and so does an em dash in a comment: Stand — heute.
export const range = "8–10 Uhr - Raum 2";
