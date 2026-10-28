// Who runs Studienbuch, in one place, so the Impressum and the Datenschutzerklärung never disagree.
// The registered data matches CLA.md.
export * as Operator from "./Operator.ts";

export const entity = {
  legalName: "Urbs UG (haftungsbeschränkt)",
  representative: "Hauke Schnau",
  street: "Stellinger Chaussee 19",
  postalCode: "22529",
  city: "Hamburg",
  country: "Deutschland",
  email: "info@urbs.one",
  registerCourt: "Amtsgericht Hamburg",
  registerNumber: "HRB 185737",
  // Held despite the §19 UStG small-business election, so §27a UStG requires it here.
  vatId: "DE367669644",
} as const;

/** Processors that receive personal data, named as Art. 28 GDPR requires. */
export const processors = [
  {
    name: "netcup GmbH",
    address: "Daimlerstraße 25, 76185 Karlsruhe, Deutschland",
    purpose: "Betrieb der Server und der Datenbank",
    location: "Deutschland",
  },
  {
    name: "Cloudflare, Inc.",
    address: "101 Townsend St., San Francisco, CA 94107, USA",
    purpose:
      "Speicherung der Ende-zu-Ende-verschlüsselten Fotos und Unterschriften sowie der verschlüsselten Datensicherungen",
    location: "Rechenzentren in der Europäischen Union (EU-Jurisdiktion)",
  },
  {
    name: "Scaleway SAS",
    address: "8 rue de la Ville-l'Évêque, 75008 Paris, Frankreich",
    purpose: "Versand von Bestätigungs- und Wiederherstellungs-E-Mails",
    location: "Frankreich (Europäische Union)",
  },
] as const;

/** The competent supervisory authority, by the company's seat. */
export const supervisoryAuthority = {
  name: "Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit",
  address: "Ludwig-Erhard-Straße 22, 20459 Hamburg",
  url: "https://datenschutz-hamburg.de",
} as const;

/** Shown as "Stand". Update it whenever the wording of either page changes. */
export const lastUpdated = "28. Oktober 2026";
