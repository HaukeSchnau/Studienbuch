import * as Schema from "effect/Schema";
import { CalendarDate } from "../foundation/calendar-date";
import { NonBlankText } from "../foundation/non-blank-text";
import { PersonId } from "./identity";

/**
 * `displayName` preserves the source/user-authored form. Structured components are optional
 * facts, never guessed by splitting the display name.
 */
export const PersonName = Schema.Struct({
  displayName: NonBlankText.Schema,
  givenNames: Schema.Array(NonBlankText.Schema),
  familyName: Schema.optionalKey(NonBlankText.Schema),
  honorific: Schema.optionalKey(NonBlankText.Schema),
});
export interface PersonName extends Schema.Schema.Type<typeof PersonName> {}

export const Person = Schema.Struct({
  id: PersonId,
  name: PersonName,
  dateOfBirth: Schema.optionalKey(CalendarDate.Schema),
});
export interface Person extends Schema.Schema.Type<typeof Person> {}

export const LeapDayAnniversary = Schema.Literals(["February28", "March1"]);
export type LeapDayAnniversary = typeof LeapDayAnniversary.Type;

/** Jurisdictional rules needed to determine adulthood on an explicit calendar date. */
export const LegalAgePolicy = Schema.Struct({
  ageOfMajority: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 30 })),
  leapDayAnniversary: LeapDayAnniversary,
});
export interface LegalAgePolicy extends Schema.Schema.Type<typeof LegalAgePolicy> {}

export const LegalStatus = Schema.Literals(["Minor", "Adult", "Unknown"]);
export type LegalStatus = typeof LegalStatus.Type;

/** Evaluates legal status for an explicit date; it never reads the ambient clock. */
export const legalStatusOn = (
  person: Person,
  on: CalendarDate.Type,
  policy: LegalAgePolicy,
): LegalStatus => {
  if (person.dateOfBirth === undefined) return "Unknown";
  const { year: birthYear, month: birthMonth, day: birthDay } = person.dateOfBirth;
  const { year, month, day } = on;
  const usesNonLeapAnniversary =
    birthMonth === 2 && birthDay === 29 && !CalendarDate.inLeapYear(on);
  let anniversaryMonth = birthMonth;
  let anniversaryDay = birthDay;
  if (usesNonLeapAnniversary) {
    if (policy.leapDayAnniversary === "February28") {
      anniversaryMonth = 2;
      anniversaryDay = 28;
    } else {
      anniversaryMonth = 3;
      anniversaryDay = 1;
    }
  }
  const age =
    year -
    birthYear -
    (month < anniversaryMonth || (month === anniversaryMonth && day < anniversaryDay) ? 1 : 0);
  return age >= policy.ageOfMajority ? "Adult" : "Minor";
};

export const requiresGuardianAcknowledgement = (
  person: Person,
  on: CalendarDate.Type,
  policy: LegalAgePolicy,
) => legalStatusOn(person, on, policy) !== "Adult";
