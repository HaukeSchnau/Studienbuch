import * as Schema from "effect/Schema";

export const SchoolAccessKind = Schema.Literals(["Student", "Teacher"]);
export type SchoolAccessKind = typeof SchoolAccessKind.Type;

/**
 * Human-entered access codes use Crockford's alphabet so `I`, `L`, `O`, and `U` never need to be
 * distinguished. Hyphens and whitespace are presentation only.
 */
export const accessCodeAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const accessCodeLength = 16;

export const normalizeAccessCode = (value: string) => value.toUpperCase().replaceAll(/[-\s]/g, "");

/**
 * The substitutions Crockford's alphabet is chosen to make safe.
 *
 * Dropping `I`, `L`, and `O` only pays off if something acts on the ambiguity: a code printed as `0`
 * that a reader types as `O` has to arrive as `0` rather than as a rejection. They are outside the
 * alphabet, so the mapping cannot collide with a real code.
 *
 * `U` is absent on purpose. Crockford excludes it to keep a random code from spelling something
 * unfortunate, not because it looks like anything else, so there is no character it should become.
 */
const confusableCharacters = new Map([
  ["I", "1"],
  ["L", "1"],
  ["O", "0"],
]);

/**
 * A typed code turned into the code that was printed, as far as the alphabet allows.
 *
 * Anything outside the alphabet after substitution is dropped rather than kept, so a stray keystroke
 * costs a character instead of invalidating everything typed after it. The result is unformatted;
 * `formatAccessCode` puts the hyphens back.
 */
export const repairAccessCode = (value: string) =>
  Array.from(normalizeAccessCode(value))
    .map((character) => confusableCharacters.get(character) ?? character)
    .filter((character) => accessCodeAlphabet.includes(character))
    .slice(0, accessCodeLength)
    .join("");

export const isAccessCode = (value: string) => {
  const normalized = normalizeAccessCode(value);
  return (
    normalized.length === accessCodeLength &&
    Array.from(normalized).every((character) => accessCodeAlphabet.includes(character))
  );
};

export const formatAccessCode = (value: string) => {
  const normalized = normalizeAccessCode(value);
  return normalized.match(/.{1,4}/g)?.join("-") ?? normalized;
};

/**
 * The longest a self-authored notebook profile field may be.
 *
 * One number rather than a validation limit and a storage limit that disagree: a name longer than
 * the server intends to keep is refused where the person can still see what they typed, instead of
 * being accepted and silently shortened.
 */
export const profileFieldMaxLength = 80;

/**
 * The name a Studienbuch account carries.
 *
 * Authentication requires every account to have one, and Studienbuch deliberately does not ask a
 * person for theirs: a real name belongs to the school-scoped notebook profile they author, not to
 * the global identity that outlives any one school. So every account carries the same placeholder,
 * and this is the one place it is written down.
 */
export const neutralAccountName = "Studienbuch-Konto";
