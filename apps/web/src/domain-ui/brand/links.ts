/**
 * Every off-page destination the marketing pages link to, in one place so the three landing-page
 * variants cannot drift apart on where a button goes.
 *
 * TODO: the store links still point at the shipping legacy app (`de.haukeschnau.class_mate` /
 * `id6449227364`). Repoint them at `dev.schnau.studienbuch` once the Expo app is published.
 */
export const storeLinks = {
  android: "https://play.google.com/store/apps/details?id=de.haukeschnau.class_mate",
  ios: "https://apps.apple.com/de/app/igs-lilienthal/id6449227364",
} as const;

/** Anchor targets used by the in-page navigation. */
export const sectionIds = {
  features: "funktionen",
  offline: "offline",
  schools: "schulen",
} as const;

export const contactEmail = "hallo@studienbuch.app";
