import { Access } from "@stu/api/Access";

// What the code fields keep of what is typed or pasted into them: the school's access code in
// groups of four, and the six digits from a mail.

export * as TypedCode from "./TypedCode.ts";

export interface Selection {
  readonly start: number;
  readonly end: number;
}

/**
 * An edit of the access code field, which held `previous` with `selection` before it and holds
 * `text` now: the code repaired and in groups, and the caret behind what was typed, pasted or
 * deleted. Blanks, hyphens and stray characters cost no room, so a whole code always fits.
 */
export const access = (previous: string, text: string, selection: Selection) => {
  const kept = previous.length - (selection.end - selection.start);
  const typedTo = Math.max(0, selection.start + text.length - kept);
  const before = Access.repair(text.slice(0, typedTo)).length;

  return {
    value: Access.format(Access.repair(text)),
    // A hyphen follows every fourth character but the last.
    caret: before + Math.max(0, Math.floor((before - 1) / 4)),
  };
};

/** How many digits a mailed code has, as the server makes them. */
export const codeLength = 6;

/** The code from a mail as typed: digits only and at most six, so "145 838" is "145838". */
export const mailed = (text: string) => text.replaceAll(/\D/gu, "").slice(0, codeLength);
