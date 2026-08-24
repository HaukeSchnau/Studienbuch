/**
 * Every off-site destination the public pages point at, in one place so the header, the download
 * section and the footer cannot drift apart.
 *
 * The store listings still carry the school-specific name of the production Flutter app that this
 * rewrite supersedes; the listings themselves are current.
 */
export const externalLinks = {
  appStore: "https://apps.apple.com/de/app/igs-lilienthal/id6449227364",
  playStore: "https://play.google.com/store/apps/details?id=dev.schnau.studienbuch",
  schoolContact: "mailto:info@urbs.one?subject=Studienbuch%20f%C3%BCr%20unsere%20Schule",
} as const;

/** In-page anchors used by the header nav. */
export const sectionIds = {
  capabilities: "funktionen",
  schools: "fuer-schulen",
  app: "app",
} as const;
