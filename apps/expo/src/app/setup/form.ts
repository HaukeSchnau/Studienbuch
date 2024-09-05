import { createContext, useContext } from "react";

import type { Class, Course, SubjectId, Year } from "@stu/lib";

import type {
  CombinedForm,
  InitialForm,
  JoinedSteps,
} from "~/utils/form/multi-step-form";

export type SetupForm = InitialForm<Steps>;

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
    chosenCourses: Partial<Record<SubjectId, Course | undefined>>;
  },
];
const stepsKeys = [
  ["licenseKey"],
  ["name", "year", "isOfAge"],
  ["class", "chosenCourses"],
] as const;

export const FormContext = createContext<CombinedForm<SetupForm> | null>(null);
export const useFormContext = <Step extends number>({
  step,
  onSubmitStep,
}: {
  step: Step;
  onSubmitStep: () => void | Promise<void>;
}): {
  form: CombinedForm<JoinedSteps<Steps, Step>>;
  handleSubmitStep: () => Promise<void>;
} => {
  // const [validatedUntil, setValidatedUntil] = useState(0); // Should be in the context
  // TODO: Validate and keep track of step
  const form = useContext(FormContext);
  if (!form) {
    throw new Error("FormContext is not provided");
  }
  // if (validatedUntil < step) {
  //   throw new Error("Form is not validated until the current step");
  // }
  const validateStep = async () => {
    if (step >= stepsKeys.length) {
      return form.validateAllFields("submit");
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const validations = stepsKeys[step]!.map((key) =>
      form.validateField(key, "submit"),
    ).map((validation) =>
      validation instanceof Promise ? validation : Promise.resolve(validation),
    );
    const results = await Promise.all(validations).then((results) =>
      results.flat(),
    );
    if (results.every((result) => !result)) {
      // setValidatedUntil(step);
    }
    return results;
  };
  return {
    form: form as unknown as CombinedForm<JoinedSteps<Steps, Step>>,
    handleSubmitStep: async () => {
      const results = await validateStep();
      if (results.every((result) => !result)) {
        await onSubmitStep();
      }
    },
  };
};
