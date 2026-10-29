// Every destination the public pages link to, in one place, so the header, the sections and the
// footer can't drift apart.
export * as Site from "./Site.ts";

/**
 * The store listings still carry the school-specific name of the legacy Flutter app; the rewrite
 * ships under the same listings.
 */
export const appStore = "https://apps.apple.com/de/app/igs-lilienthal/id6449227364";
export const playStore = "https://play.google.com/store/apps/details?id=dev.schnau.studienbuch";

/** The web app, on the page's own origin. */
export const webApp = "/app/";

export const email = "info@urbs.one";
export const schoolEnquiry = `mailto:${email}?subject=${encodeURIComponent("Studienbuch für unsere Schule")}`;

/** Section anchors of the landing page. */
export const sections = {
  features: "funktionen",
  privacy: "verschluesselt",
  schools: "fuer-schulen",
  app: "app",
} as const;

export type Section = (typeof sections)[keyof typeof sections];

/** Absolute, so the header and footer still work from the Impressum and the Datenschutzerklärung. */
export const sectionHref = (id: Section) => `/#${id}`;
