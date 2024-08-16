import type { FormApi, ReactFormApi } from "@tanstack/react-form";
import type { zodValidator } from "@tanstack/zod-form-adapter";
import { createContext, useContext } from "react";

import type { Year } from "@schnau/lib";

export interface SetupForm {
  licenseKey: string;
  name: string;
  isOfAge: boolean;
  year: Year | null;
  classId: number | null;
  chosenCourses: Record<string, number>;
}

type Form = FormApi<SetupForm, ZodValidator> &
  ReactFormApi<SetupForm, ZodValidator>;
export const FormContext = createContext<Form | null>(null);
export const useFormContext = () => {
  const form = useContext(FormContext);
  if (!form) {
    throw new Error("FormContext is not provided");
  }
  return form;
};

type ZodValidator = ReturnType<typeof zodValidator>;
