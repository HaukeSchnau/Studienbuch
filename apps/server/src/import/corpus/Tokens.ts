/**
 * Keyed pseudonyms for the corpus (m2-import-corpus.md, section 4). A token is
 * `HMAC-SHA256(key, kind, value)` cut to a few base32 characters, so the same key gives the same
 * token in every run and every capture. Two values that meet on one token are told apart by
 * hashing again with an attempt counter; whoever registers first keeps the first token.
 */
// Effect's Crypto has digests but no HMAC, and a token is made synchronously while walking a read.
// oxlint-disable-next-line effecttsgo/node-builtin-import -- see above
import * as NodeCrypto from "node:crypto";

export * as Tokens from "./Tokens.ts";

/** Teachers, students, any other person, rooms, and free text. */
export type Kind = "T" | "S" | "P" | "R" | "X";

export type Person = "T" | "S" | "P";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Characters per token, wide enough that two values of a school meet on one token about once in
 * ten thousand captures. A collision resolves by registration order, which a later capture that
 * adds or loses a colliding value would change, moving a token.
 */
export const widths: Readonly<Record<Kind, number>> = { T: 7, S: 7, P: 7, R: 7, X: 8 };

/** Pseudonymized person ids: twelve digits, far above WebUntis's own ids, for the same reason. */
export const ids = { min: 100_000_000_000, size: 900_000_000_000 } as const;

export const name = new RegExp(`^[TSPR][${alphabet}]{${widths.T}}$`, "u");

export const text = new RegExp(`^X[${alphabet}]{${widths.X}}-\\d+$`, "u");

const person = new RegExp(`[TSP][${alphabet}]{${widths.T}}`, "gu");

/**
 * The text with each run that could be a person's token, such as one the pseudonymizer put into a
 * subject's code, cut to its kind: `BI-TQ4M7KZA` becomes `BI-T*`.
 */
export const withoutPeople = (text: string) =>
  text.replace(person, (token) => `${token.slice(0, 1)}*`);

export const isId = (value: number) =>
  Number.isInteger(value) && value >= ids.min && value < ids.min + ids.size;

export interface Tokens {
  /** The token of a value, such as `TQ4M7KZ` for a teacher. */
  readonly token: (kind: Kind, value: string) => string;
  /** A person's numeric id in the reserved range. */
  readonly id: (kind: Person, id: number) => number;
}

const base32 = (bytes: Uint8Array, length: number) => {
  let bits = 0;
  let buffer = 0;
  let out = "";

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;

    while (bits >= 5 && out.length < length) {
      out += alphabet[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }

    if (out.length === length) return out;
  }

  return out;
};

/** `options` shrink the token space, so a test can force collisions. */
export const make = (
  key: Uint8Array,
  options: {
    readonly width?: number;
    readonly ids?: { readonly min: number; readonly size: number };
  } = {},
): Tokens => {
  const range = options.ids ?? ids;

  const hmac = (input: string) =>
    new Uint8Array(NodeCrypto.createHmac("sha256", key).update(input).digest());

  /** One registry per kind: value to pseudonym, and the pseudonyms taken. */
  const registry = <A>(candidate: (value: string, attempt: number) => A) => {
    const given = new Map<string, A>();
    const taken = new Set<A>();

    return (value: string) => {
      const known = given.get(value);

      if (known !== undefined) return known;

      for (let attempt = 0; ; attempt++) {
        const next = candidate(value, attempt);

        if (!taken.has(next)) {
          given.set(value, next);
          taken.add(next);

          return next;
        }
      }
    };
  };

  const tokens = new Map<Kind, (value: string) => string>();
  const numbers = new Map<Person, (value: string) => number>();

  const tokenOf = (kind: Kind) => {
    const known = tokens.get(kind);

    if (known !== undefined) return known;

    const made = registry(
      (value, attempt) =>
        `${kind}${base32(hmac(`${kind}\u0000${value}\u0000${attempt}`), options.width ?? widths[kind])}`,
    );

    tokens.set(kind, made);

    return made;
  };

  const numberOf = (kind: Person) => {
    const known = numbers.get(kind);

    if (known !== undefined) return known;

    const made = registry((value, attempt) => {
      const digest = hmac(`#${kind}\u0000${value}\u0000${attempt}`);
      const high = ((digest[0] ?? 0) << 16) | ((digest[1] ?? 0) << 8) | (digest[2] ?? 0);
      const low = ((digest[3] ?? 0) << 16) | ((digest[4] ?? 0) << 8) | (digest[5] ?? 0);

      return range.min + ((high * 2 ** 24 + low) % range.size);
    });

    numbers.set(kind, made);

    return made;
  };

  return {
    token: (kind, value) => tokenOf(kind)(value),
    id: (kind, id) => numberOf(kind)(String(id)),
  };
};
