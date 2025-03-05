import type { FormApi, ReactFormApi } from "@tanstack/react-form";
import type { ZodValidator } from "@tanstack/zod-form-adapter";

type TakeUntil<Objs extends unknown[], Num extends number> = Objs extends [
  ...infer Head,
  infer _,
]
  ? Head["length"] extends Num
    ? Objs
    : TakeUntil<Head, Num>
  : never;

type Joined<Objs extends unknown[]> = Objs extends [
  ...infer Head,
  infer Tail,
  infer Current,
]
  ? Joined<Head> & Required<Tail> & Current
  : Objs extends [infer Current]
    ? Current
    : unknown;

type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type JoinedSteps<Steps extends unknown[], Num extends number> = Prettify<
  Num extends Steps["length"]
    ? Steps extends [...infer _, infer Tail]
      ? Joined<Steps> & Required<Tail>
      : unknown
    : Joined<TakeUntil<Steps, Num>>
>;

type JoinedNonRequired<Objs extends unknown[]> = Objs extends [
  ...infer Head,
  infer Tail,
  infer Current,
]
  ? Joined<Head> & Tail & Current
  : Objs extends [infer Current]
    ? Current
    : unknown;

type JoinedStepsNonRequired<
  Steps extends unknown[],
  Num extends number,
> = Prettify<
  Num extends Steps["length"]
    ? Steps extends [...infer _, infer Tail]
      ? JoinedNonRequired<Steps> & Tail
      : unknown
    : JoinedNonRequired<TakeUntil<Steps, Num>>
>;

export type CompleteForm<Steps extends unknown[]> = JoinedSteps<
  Steps,
  Steps["length"]
>;

export type InitialForm<Steps extends unknown[]> = JoinedStepsNonRequired<
  Steps,
  Steps["length"]
>;

export type CombinedForm<TForm> = FormApi<
  TForm,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
> &
  ReactFormApi<TForm, any, any, any, any, any, any, any, any, any>;
