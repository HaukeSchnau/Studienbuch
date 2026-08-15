import * as Schema from "effect/Schema";
import { CalendarDate, NonEmptyText, PersonId } from "../foundation";

/**
 * `displayName` preserves the source/user-authored form. Structured components are optional
 * facts, never guessed by splitting the display name.
 */
export const PersonName = Schema.Struct({
  displayName: NonEmptyText,
  givenNames: Schema.Array(NonEmptyText),
  familyName: Schema.optionalKey(NonEmptyText),
  honorific: Schema.optionalKey(NonEmptyText),
});
export interface PersonName extends Schema.Schema.Type<typeof PersonName> {}

export const Person = Schema.Struct({
  id: PersonId,
  name: PersonName,
  dateOfBirth: Schema.optionalKey(CalendarDate),
});
export interface Person extends Schema.Schema.Type<typeof Person> {}

export const LegalAgePolicy = Schema.Struct({
  ageOfMajority: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 30 })),
});
export interface LegalAgePolicy extends Schema.Schema.Type<typeof LegalAgePolicy> {}

export const LegalStatus = Schema.Literals(["Minor", "Adult", "Unknown"]);
export type LegalStatus = typeof LegalStatus.Type;

/** Evaluates legal status for an explicit date; it never reads the ambient clock. */
export const legalStatusOn = (
  person: Person,
  on: CalendarDate,
  policy: LegalAgePolicy,
): LegalStatus => {
  if (person.dateOfBirth === undefined) return "Unknown";
  const birthYear = Number(person.dateOfBirth.slice(0, 4));
  const birthMonth = Number(person.dateOfBirth.slice(5, 7));
  const birthDay = Number(person.dateOfBirth.slice(8, 10));
  const year = Number(on.slice(0, 4));
  const month = Number(on.slice(5, 7));
  const day = Number(on.slice(8, 10));
  const age =
    year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
  return age >= policy.ageOfMajority ? "Adult" : "Minor";
};

export const requiresGuardianAcknowledgement = (
  person: Person,
  on: CalendarDate,
  policy: LegalAgePolicy,
) => legalStatusOn(person, on, policy) !== "Adult";
