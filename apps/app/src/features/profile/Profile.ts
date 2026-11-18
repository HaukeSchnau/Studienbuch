import type { School } from "@stu/core";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";

import type { Onboarding } from "../onboarding/Onboarding.ts";

// Who the student is, as Profil shows it: only what the device holds already. Onboarding (M3.1)
// adds what is missing, so a fact the device doesn't hold stays out instead of showing a blank.

export * as Profile from "./Profile.ts";

export interface Facts {
  /** From the encrypted profile, which a locked device can't read. */
  readonly name: Option.Option<string>;
  readonly school: Option.Option<string>;
  /** From the course choice for today's term, so there is none between terms. */
  readonly gradeLevel: Option.Option<School.GradeLevel>;
  readonly schoolClass: Option.Option<string>;
}

const none: Facts = {
  name: Option.none(),
  school: Option.none(),
  gradeLevel: Option.none(),
  schoolClass: Option.none(),
};

/** What the device holds: nothing while it reads, and what it read last after a read that failed. */
export const facts = (reading: AsyncResult.AsyncResult<Onboarding.Reading, unknown>): Facts => {
  const now = AsyncResult.value(reading);

  if (Option.isNone(now) || now.value._tag !== "Ready") return none;

  const { profile, schoolName, term } = now.value.snapshot;
  const enrollment = Option.flatMap(term, (choices) => choices.enrollment);

  return {
    name: Option.filter(Option.fromNullishOr(profile.displayName?.trim()), (name) => name !== ""),
    school: Option.filter(Option.some(schoolName), (name) => name !== ""),
    gradeLevel: Option.map(enrollment, (row) => row.gradeLevel),
    schoolClass: Option.flatMap(term, (choices) =>
      Option.flatMap(enrollment, (row) =>
        Option.map(
          Option.fromNullishOr(choices.classes.find((each) => each.id === row.classId)),
          (each) => each.name,
        ),
      ),
    ),
  };
};

/** "Jahrgang 11, Klasse 11c", or as much of it as the device holds. */
export const placement = ({ gradeLevel, schoolClass }: Facts): Option.Option<string> => {
  const parts = [
    ...Option.toArray(Option.map(gradeLevel, (level) => `Jahrgang ${String(level)}`)),
    ...Option.toArray(Option.map(schoolClass, (name) => `Klasse ${name}`)),
  ];

  return parts.length === 0 ? Option.none() : Option.some(parts.join(", "));
};

/** The first letters of the first and the last word, as "LB" for "Lena Beispiel". */
export const initials = (name: string) => {
  const words = name.trim().split(/\s+/u);
  const first = (word: string | undefined) => Array.from(word ?? "")[0] ?? "";

  return (first(words[0]) + (words.length > 1 ? first(words.at(-1)) : "")).toLocaleUpperCase("de");
};
