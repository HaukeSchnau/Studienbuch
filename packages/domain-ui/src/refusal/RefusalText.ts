/**
 * What a device says when the server refused one of its changes: the card's title, and one sentence
 * per refusal tag (m1-screens.md, "Refusal sentences"). A tag from a newer server gets `fallback`.
 */
import type { Homework } from "@stu/core";

export * as RefusalText from "./RefusalText.ts";

export const title = "Nicht übernommen";

export const fallback = "Der Server hat die Änderung abgelehnt.";

// Every refusal of a homework mutator needs its sentence before it compiles.
const homework = {
  "Homework.CourseNotChosen":
    "Dieser Kurs ist nicht mehr in deiner Kurswahl. Vielleicht hast du ihn auf einem anderen Gerät abgewählt.",
  "Homework.NotFound": "Diese Hausaufgabe wurde auf einem anderen Gerät gelöscht.",
} as const satisfies Record<Homework.Refusal["_tag"], string>;

// The engine's own refusals and the `Tx` errors of a mutator run again on the server. Their types
// live in @stu/sync, which this package may not import.
const engine = {
  "Sync.NotMember": "Diese Änderung gehört in ein Notizbuch, in dem du nicht Mitglied bist.",
  "Sync.NotAllowed": "Hier darfst du nichts ändern.",
  "Sync.Locked": "Dieser Eintrag ist bestätigt und lässt sich nicht mehr ändern.",
  "Sync.BadEnvelope": "Die Änderung kam beschädigt beim Server an. Versuch es noch einmal.",
  "Sync.TooLarge": "Die Änderung ist zu groß. Kürz den Text und versuch es noch einmal.",
  "Sync.UnknownMutator": "Diese Änderung kennt der Server nicht mehr. Aktualisiere die App.",
  "Sync.InvalidArgs": "Der Server konnte die Änderung nicht lesen. Aktualisiere die App.",
  "Tx.RowExists": "Diesen Eintrag gibt es schon.",
  "Tx.RowMissing": "Diesen Eintrag gibt es nicht mehr.",
  "Tx.InvalidRow": "Der Eintrag ist ungültig.",
  "Tx.InvalidId": "Der Eintrag ist ungültig.",
} as const;

const sentences: ReadonlyMap<string, string> = new Map(Object.entries({ ...homework, ...engine }));

/** The sentence for a refusal's tag. */
export const sentence = (reason: { readonly _tag: string }): string =>
  sentences.get(reason._tag) ?? fallback;

/** Shown on the sign-in screen after the server reported `Sync.DeviceRevoked` and the device wiped itself. */
export const deviceRevoked =
  "Dieses Gerät wurde auf einem anderen Gerät entfernt. Seine Daten wurden gelöscht.";
