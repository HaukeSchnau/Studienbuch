/**
 * The operator's own details, in one place because the Impressum, the Datenschutzerklärung and the
 * footer must never disagree about them. The registered data matches `CLA.md`.
 */
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
  /** Held despite the §19 UStG small-business election, so §27a UStG requires it here. */
  vatId: "DE367669644",
} as const;

/** Processors that receive personal data, named as Art. 28 GDPR requires. */
export const processors = [
  {
    name: "netcup GmbH",
    address: "Daimlerstraße 25, 76185 Karlsruhe, Deutschland",
    purpose: "Betrieb der Server und Speicherung der Anwendungsdaten",
    location: "Deutschland",
  },
  {
    name: "Functional Software, Inc. (Sentry)",
    address: "45 Fremont Street, 8th Floor, San Francisco, CA 94105, USA",
    purpose: "Empfang technischer Fehlerberichte",
    location: "EU-Region (de.sentry.io), Rechenzentren in der Europäischen Union",
  },
  {
    name: "Scaleway SAS",
    address: "8 rue de la Ville-l’Évêque, 75008 Paris, Frankreich",
    purpose: "Versand von Bestätigungs- und Wiederherstellungs-E-Mails",
    location: "Frankreich (Europäische Union)",
  },
] as const;

/** The competent supervisory authority, determined by the company's seat. */
export const supervisoryAuthority = {
  name: "Der Hamburgische Beauftragte für Datenschutz und Informationsfreiheit",
  address: "Ludwig-Erhard-Straße 22, 20459 Hamburg",
  url: "https://datenschutz-hamburg.de",
} as const;

/**
 * Shown as "Stand" on the legal pages. Update it whenever their wording changes — a
 * Datenschutzerklärung without a current date is worth little.
 */
export const legalLastUpdated = "25. August 2026";
