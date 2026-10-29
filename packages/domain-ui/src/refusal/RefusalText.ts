/**
 * What a device says when the server refused one of its changes: the card's title, and one sentence
 * per refusal tag (m1-screens.md, "Refusal sentences"). A tag from a newer server gets `fallback`.
 */
import type { Enrollment, Homework } from "@stu/core";

export * as RefusalText from "./RefusalText.ts";

export const title = "Nicht übernommen";

export const fallback = "Der Server hat die Änderung abgelehnt.";

// Every refusal of a core mutator needs its sentence before it compiles.
const core = {
  "Homework.CourseNotChosen":
    "Dieser Kurs ist nicht mehr in deiner Kurswahl. Vielleicht hast du ihn auf einem anderen Gerät abgewählt.",
  "Homework.NotFound": "Diese Hausaufgabe wurde auf einem anderen Gerät gelöscht.",
  "Enrollment.UnknownTerm": "Dieses Halbjahr gibt es an deiner Schule nicht.",
  "Enrollment.ClassRequired": "Wähl zuerst deine Klasse, dann deine Kurse.",
  "Enrollment.CourseNotOffered": "Dieser Kurs wird in diesem Halbjahr nicht angeboten.",
  "Enrollment.TwoInOneGroup": "Von diesen Kursen kannst du nur einen wählen.",
} as const satisfies Record<Homework.Refusal["_tag"] | Enrollment.Refusal["_tag"], string>;

// Refusals whose types live in @stu/sync, which this package may not import.
const other = {
  "Sync.NotMember": "Diese Änderung gehört in ein Notizbuch, in dem du nicht Mitglied bist.",
  "Sync.NotAllowed": "Hier darfst du nichts ändern.",
  "Sync.Locked": "Dieser Eintrag ist bestätigt und lässt sich nicht mehr ändern.",
  "Sync.BadEnvelope": "Die Änderung kam beschädigt beim Server an. Versuch es noch einmal.",
  "Sync.TooLarge": "Die Änderung ist zu groß. Kürz den Text und versuch es noch einmal.",
  "Sync.UnknownMutator": "Diese Änderung kennt der Server nicht mehr. Aktualisiere die App.",
  "Sync.InvalidArgs": "Der Server konnte die Änderung nicht lesen. Aktualisiere die App.",
  // On the sign-in screen, after the device wiped itself.
  "Sync.DeviceRevoked":
    "Dieses Gerät wurde auf einem anderen Gerät entfernt. Seine Daten wurden gelöscht.",
  "Tx.RowExists": "Diesen Eintrag gibt es schon.",
  "Tx.RowMissing": "Diesen Eintrag gibt es nicht mehr.",
  "Tx.InvalidRow": "Der Eintrag ist ungültig.",
  "Tx.InvalidId": "Der Eintrag ist ungültig.",
} as const;

const sentences: ReadonlyMap<string, string> = new Map(Object.entries({ ...core, ...other }));

/** The sentence for a refusal's tag. */
export const sentence = (reason: { readonly _tag: string }): string =>
  sentences.get(reason._tag) ?? fallback;
