import type { FormApi, ReactFormApi } from "@tanstack/react-form";
import type { zodValidator } from "@tanstack/zod-form-adapter";
import { createContext, useContext } from "react";

import type { Class, Course, Year } from "@schnau/lib";

export interface SetupForm {
  licenseKey: string;
  name: string;
  isOfAge: boolean;
  year: Year | null;
  class: Class | null;
  chosenCourses: Record<string, Course>;
}

type Steps = [
  {
    licenseKey: string;
  },
  {
    name: string;
    year?: Year;
    isOfAge: boolean;
  },
  {
    class?: Class;
    chosenCourses: Record<string, Course>;
  },
];

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
type JoinedSteps<Steps extends unknown[], Num extends number> = Prettify<
  Num extends Steps["length"]
    ? Steps extends [...infer Head, infer Tail]
      ? Joined<Steps> & Required<Tail>
      : unknown
    : Joined<TakeUntil<Steps, Num>>
>;

type CombinedForm<TForm> = FormApi<TForm, ZodValidator> &
  ReactFormApi<TForm, ZodValidator>;

export const FormContext = createContext<CombinedForm<SetupForm> | null>(null);
export const useFormContext = <Step extends number>(
  step: Step,
): CombinedForm<JoinedSteps<Steps, Step>> => {
  // TODO: Validate and keep track of step
  const form = useContext(FormContext);
  if (!form) {
    throw new Error("FormContext is not provided");
  }
  return form as unknown as CombinedForm<JoinedSteps<Steps, Step>>;
};

type ZodValidator = ReturnType<typeof zodValidator>;
