import { type CivilTime, Homework, type Notebook } from "@stu/core";
import type { HomeworkItem } from "@stu/domain-ui/homework/HomeworkItem";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

// What the Übersicht says about the notebook: the greeting, a change that wasn't taken over, and
// the device's connection. The homework panel's own rules are `HomeworkItem.panel`.

export * as Overview from "./Overview.ts";

/** What the device holds for the Übersicht, read in one go. */
export interface Reading {
  /** `None` until the notebook's first rows arrived. */
  readonly notebook: Option.Option<Notebook.Id>;
  /** The student's name from the encrypted profile, which only an unlocked device reads. */
  readonly name: Option.Option<string>;
  /** Today at the school, and the time zone that decides it. */
  readonly today: CivilTime.PlainDate;
  readonly timeZone: CivilTime.TimeZone;
  readonly homework: ReadonlyArray<HomeworkItem.Source>;
  /** The homework changes the server refused, oldest first. */
  readonly refused: ReadonlyArray<Refused>;
}

/** A refused command as the engine keeps it, until the student tries again or lets it go. */
export interface Refused {
  readonly clientId: string;
  readonly mutationId: number;
  readonly name: string;
  readonly args: Schema.Json;
  readonly reason: { readonly _tag: string };
}

/** A change this device refused itself, before anything was queued. */
export interface Failed {
  readonly change: string;
  readonly reason: { readonly _tag: string };
}

export const greeting = (name: Option.Option<string>): string =>
  Option.match(name, { onNone: () => "Moin!", onSome: (first) => `Moin, ${first}!` });

/** Whether the Übersicht shows a refused command. Other screens show the refusals of their own. */
export const shows = (refused: Pick<Refused, "name">): boolean =>
  refused.name.startsWith("homework.");

/** What ticking the homework's box asks for, in the words a refusal card repeats. */
export const ticking = (homework: Pick<HomeworkItem.Item, "title" | "done">): string =>
  `${homework.done ? "Wieder offen" : "Erledigt"}: ${homework.title}`;

const decodeTick = Schema.decodeUnknownOption(Homework.setDone.args);
const decodeNew = Schema.decodeUnknownOption(Homework.create.args);

/**
 * What a refused command was, from its stored arguments, such as "Erledigt: Vocabulary Unit 3".
 * A tick stores only the homework's id, so its title comes from the device's rows.
 */
export const describe = (
  refused: Pick<Refused, "name" | "args">,
  homework: ReadonlyArray<Pick<HomeworkItem.Source, "id" | "title">>,
): string => {
  switch (refused.name) {
    case Homework.setDone.name:
      return Option.match(decodeTick(refused.args), {
        onNone: () => unknown,
        onSome: ({ id, doneOn }) =>
          ticking({
            title: homework.find((each) => each.id === id)?.title ?? "eine Hausaufgabe",
            done: doneOn === undefined,
          }),
      });
    case Homework.create.name:
      return Option.match(decodeNew(refused.args), {
        onNone: () => unknown,
        onSome: ({ title }) => `Neue Hausaufgabe: ${title}`,
      });
    default:
      return unknown;
  }
};

const unknown = "Eine Änderung an deinen Hausaufgaben";

/** The device's connection, as far as the Übersicht mentions it. */
export interface Connection {
  readonly offline: boolean;
  /** Changes the server hasn't settled. */
  readonly waiting: number;
}

/** What the chip under the date says. Online, the screen says nothing about the connection. */
export const chip = ({ offline, waiting }: Connection): Option.Option<string> =>
  !offline
    ? Option.none()
    : Option.some(
        waiting === 0
          ? "Offline"
          : waiting === 1
            ? "Offline, 1 Änderung wartet"
            : `Offline, ${String(waiting)} Änderungen warten`,
      );
