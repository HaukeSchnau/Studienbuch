import { Homework, NotebookProfile } from "@stu/core";
import type { Outbox } from "@stu/sync/client";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// What a refused change was, in one line for its card, built from the command's stored arguments
// and the titles the device still holds (sync.md, "Refusals stay visible").

export * as Refused from "./Refused.ts";

// The fields a line names, from any of the notebook's mutators. Each is optional, so an argument
// shape from an older or newer app still gives a line.
const decodeArgs = Schema.decodeUnknownOption(
  Schema.Struct({
    id: Schema.optional(Schema.String),
    title: Schema.optional(Schema.String),
    doneOn: Schema.optional(Schema.String),
  }),
);

const about = (verb: string, title: string | undefined) =>
  `${verb}: ${title ?? "eine Hausaufgabe"}`;

/** "Abgehakt: Vocabulary Unit 4 lernen", or "Wieder geöffnet: …" for a tick the other way. */
export const tick = (done: boolean, title: string | undefined) =>
  about(done ? "Abgehakt" : "Wieder geöffnet", title);

/** "Neue Hausaufgabe: …", "Abgehakt: …", "Eine Änderung". */
export const change = (rejected: Outbox.Rejected, titles: ReadonlyMap<string, string>): string => {
  const args = Option.getOrElse(decodeArgs(rejected.args), () => ({
    id: undefined,
    title: undefined,
    doneOn: undefined,
  }));

  const title = args.title ?? (args.id === undefined ? undefined : titles.get(args.id));

  switch (rejected.name) {
    case Homework.create.name:
      return about("Neue Hausaufgabe", title);
    case Homework.update.name:
      return about("Geändert", title);
    case Homework.setDone.name:
      return tick(args.doneOn !== undefined, title);
    case Homework.delete.name:
      return about("Gelöscht", title);
    case NotebookProfile.set.name:
      return "Dein Name im Notizbuch";
    default:
      return "Eine Änderung";
  }
};
