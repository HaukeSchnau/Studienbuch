import type { FormApi } from "@tanstack/react-form";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";

import type { SchoolId, Year } from "@stu/lib";
import { SCHOOL_IDS } from "@stu/lib";

import { Button } from "~/components/form/Button";
import { NumberField } from "~/components/form/NumberField";
import { SelectField } from "~/components/form/SelectField";
import { TextField } from "~/components/form/TextField";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";

interface YearFormValues {
  name: string;
  school?: SchoolId;
  startYear?: number;
  numberOfYears?: number;
}

const yearSchema = z.object({
  name: z.string().min(1, "Name darf nicht leer sein"),
  schoolId: z.enum(SCHOOL_IDS),
  startYear: z
    .number({
      invalid_type_error: "Startjahr muss eine Zahl sein",
      required_error: "Startjahr darf nicht leer sein",
    })
    .min(1900, "Startjahr muss mindestens 1900 sein"),
  numberOfYears: z
    .number({
      invalid_type_error: "Anzahl Jahre muss eine Zahl sein",
      required_error: "Anzahl Jahre darf nicht leer sein",
    })
    .min(1, "Anzahl Jahre muss mindestens 1 sein"),
});

type YearOutput = z.infer<typeof yearSchema>;

type ZodValidator = ReturnType<typeof zodValidator>;

interface Props {
  defaultYear?: Year;
  onSubmit: (props: {
    value: YearOutput;
    formApi: FormApi<YearFormValues, ZodValidator>;
  }) => void;
  error?: string;
  isPending?: boolean;
}

export const YearForm = ({
  onSubmit,
  defaultYear,
  error,
  isPending,
}: Props) => {
  const { Field, handleSubmit } = useForm<YearFormValues, ZodValidator>({
    validatorAdapter: zodValidator(),
    defaultValues: {
      name: defaultYear?.name ?? "",
      school: defaultYear?.school,
      startYear: defaultYear?.startYear,
      numberOfYears: defaultYear
        ? defaultYear.graduationYear - defaultYear.startYear
        : 9,
    },
    onSubmit: ({ value, formApi }) => {
      const parsed = yearSchema.parse(value);
      onSubmit({ value: parsed, formApi });
    },
  });

  const schools = api.schools.list.useQuery();

  return (
    <form
      onSubmit={submitHandler(handleSubmit)}
      className="flex flex-col gap-4"
    >
      <Field
        name="name"
        validators={{
          onChange: yearSchema.shape.name,
        }}
      >
        {(field) => (
          <TextField
            label="Name"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </Field>

      {schools.isPending ? (
        <LoadingIndicator />
      ) : schools.isError ? (
        <div>{schools.error.message}</div>
      ) : (
        <Field
          name="school"
          validators={{
            onChange: yearSchema.shape.schoolId,
          }}
        >
          {(field) => (
            <SelectField
              label="Schule"
              emptyLabel="Keine Schule ausgewählt"
              valueId={field.state.value}
              options={schools.data}
              getOptionLabel={(school) => school.name}
              getOptionId={(school) => school.id}
              onChange={(school) => field.handleChange(school?.id)}
              error={field.state.meta.errors.join(", ")}
            />
          )}
        </Field>
      )}

      <Field
        name="startYear"
        validators={{
          onChange: yearSchema.shape.startYear,
        }}
      >
        {(field) => (
          <NumberField
            label="Startjahr"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </Field>

      <Field
        name="numberOfYears"
        validators={{
          onChange: yearSchema.shape.numberOfYears,
        }}
      >
        {(field) => (
          <NumberField
            label="Anzahl Jahre"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </Field>

      <Button type="submit" className="self-end" disabled={isPending}>
        {isPending ? <LoadingIndicator /> : "Speichern"}
      </Button>

      {error && <div className="text-danger">{error}</div>}
    </form>
  );
};
