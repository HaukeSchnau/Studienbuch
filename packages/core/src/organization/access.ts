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
