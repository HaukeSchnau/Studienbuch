import * as Option from "effect/Option";

// Ticks and deletes this device refused itself, one per homework and kind, kept until the student
// retries or lets them go. A later change to another homework doesn't hide them.

export * as LocalRefusals from "./LocalRefusals.ts";

export interface Refusal {
  readonly _tag: string;
  /** The homework it is about. */
  readonly id: string;
}

/** Oldest first. A list, so the device can keep it as JSON across a restart. */
export type Held<A extends Refusal> = ReadonlyArray<A>;

const isOf = (kind: string, id: string) => (refusal: Refusal) =>
  refusal._tag === kind && refusal.id === id;

/**
 * After a change of `kind` to homework `id`: holds its refusal, or lets an earlier one of that kind
 * go once the change worked.
 */
export const settle = <A extends Refusal>(
  held: Held<A>,
  kind: A["_tag"],
  id: string,
  refused: Option.Option<A>,
): Held<A> => [...held.filter((each) => !isOf(kind, id)(each)), ...Option.toArray(refused)];

/** "Verwerfen": lets one refusal go. */
export const dismiss = <A extends Refusal>(held: Held<A>, refusal: A): Held<A> =>
  held.filter((each) => !isOf(refusal._tag, refusal.id)(each));
