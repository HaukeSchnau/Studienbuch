import * as Option from "effect/Option";

// Ticks and deletes this device refused itself, one per homework and kind, kept until the student
// retries or lets them go. A later change to another homework doesn't hide them.

export * as LocalRefusals from "./LocalRefusals.ts";

export interface Refusal {
  readonly _tag: string;
  /** The homework it is about. */
  readonly id: string;
}

export type Held<A extends Refusal> = ReadonlyMap<string, A>;

const keyOf = (kind: string, id: string) => `${kind} ${id}`;

/**
 * After a change of `kind` to homework `id`: holds its refusal, or lets an earlier one of that kind
 * go once the change worked.
 */
export const settle = <A extends Refusal>(
  held: Held<A>,
  kind: A["_tag"],
  id: string,
  refused: Option.Option<A>,
): Held<A> => {
  const next = new Map(held);

  if (Option.isSome(refused)) next.set(keyOf(kind, id), refused.value);
  else next.delete(keyOf(kind, id));

  return next;
};

/** "Verwerfen": lets one refusal go. */
export const dismiss = <A extends Refusal>(held: Held<A>, refusal: A): Held<A> => {
  const next = new Map(held);

  next.delete(keyOf(refusal._tag, refusal.id));

  return next;
};
