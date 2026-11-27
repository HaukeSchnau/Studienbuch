import { Homework, NotebookProfile } from "@stu/core";
import type { Outbox } from "@stu/sync/client";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import type { HomeworkState } from "./HomeworkState.ts";

// What a refused change was, in one line for its card, built from the command's stored arguments
// and the titles the device still holds (sync.md, "Refusals stay visible").

export * as Refused from "./Refused.ts";

// The fields a line names, from any of the notebook's mutators. Each is optional, so an argument
// shape from an older or newer app still gives a line. The mutators' JSON codec stores an absent
// field as `null`, so this reads them with the same codec.
const decodeArgs = Schema.decodeUnknownOption(
  Schema.toCodecJson(
    Schema.Struct({
      id: Schema.optional(Schema.String),
      title: Schema.optional(Schema.String),
      doneOn: Schema.optional(Schema.String),
    }),
  ),
);

const about = (verb: string, title: string | undefined) =>
  `${verb}: ${title ?? "eine Hausaufgabe"}`;

/** "Abgehakt: Vocabulary Unit 4 lernen", or "Wieder geöffnet: …" for a tick the other way. */
export const tick = (done: boolean, title: string | undefined) =>
  about(done ? "Abgehakt" : "Wieder geöffnet", title);

/** "Gelöscht: Vocabulary Unit 4 lernen" */
export const removal = (title: string | undefined) => about("Gelöscht", title);

/** "Neue Hausaufgabe: …", "Abgehakt: …", "Eine Änderung". */
export const change = (
  rejected: Pick<Outbox.Rejected, "name" | "args">,
  titles: ReadonlyMap<string, string>,
): string => {
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
      return removal(title);
    case NotebookProfile.set.name:
      return "Dein Name im Notizbuch";
    default:
      return "Eine Änderung";
  }
};

/**
 * The lines for the ticks and deletes this device refused itself, each with its refusal. None
 * without the notebook's key, where the screens show nothing of the notebook. One about homework
 * another device deleted since keeps its card, about "eine Hausaufgabe".
 */
export const local = (
  held: ReadonlyArray<HomeworkState.LocalRefusal>,
  titles: ReadonlyMap<string, string>,
  readable: boolean,
) =>
  readable
    ? held.map((refused) => ({
        refused,
        change:
          refused._tag === "HomeworkState.NotToggled"
            ? tick(refused.done, titles.get(refused.id))
            : removal(titles.get(refused.id)),
      }))
    : [];
