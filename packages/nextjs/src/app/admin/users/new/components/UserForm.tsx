import type { FormApi } from "@tanstack/react-form";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";

import type { Salutation } from "@stu/lib";
import { SALUTATIONS } from "@stu/lib";

import { Button } from "~/components/form/Button";
import { SelectField } from "~/components/form/SelectField";
import { TextField } from "~/components/form/TextField";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { submitHandler } from "~/infrastructure/forms/submitHandler";

interface UserFormValues {
  firstName: string;
  lastName: string;
  email?: string;
  password?: string;
  passwordConfirmation?: string;
  salutation?: Salutation;
  abbrv?: string;
}

const userSchema = z.object({
  name: z.string().min(1, "Name darf nicht leer sein"),
  email: z.string().email().optional(),
  password: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .optional(),
  title: z.enum(SALUTATIONS).optional(),
  abbrv: z.string().optional(),
});

type UserOutput = z.infer<typeof userSchema>;
type ZodValidator = ReturnType<typeof zodValidator>;

interface Props {
  defaultUser?: {
    schoolId: number;
    name: string;
    email: string;
    salutation: Salutation;
    abbrv: string;
  };
  onSubmit: (props: {
    value: UserOutput;
    formApi: FormApi<UserFormValues, ZodValidator>;
  }) => void;
  error?: string;
  isPending?: boolean;
}

export const UserForm = ({
  onSubmit,
  defaultUser,
  error,
  isPending,
}: Props) => {
  const { Field, handleSubmit } = useForm<UserFormValues, ZodValidator>({
    validatorAdapter: zodValidator(),
    defaultValues: {
      name: defaultUser?.name ?? "",
      email: defaultUser?.email ?? undefined,
      salutation: defaultUser?.salutation ?? undefined,
      abbrv: defaultUser?.abbrv ?? undefined,
    },
    onSubmit: ({ value, formApi }) => {
      const parsed = userSchema.parse(value);
      onSubmit({ value: parsed, formApi });
    },
  });

  return (
    <form
      onSubmit={submitHandler(handleSubmit)}
      className="flex flex-col gap-4"
    >
      <Field
        name="name"
        validators={{
          onChange: userSchema.shape.name,
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

      <Field
        name="email"
        validators={{
          onChange: userSchema.shape.email,
        }}
      >
        {(field) => (
          <TextField
            label="Email"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value || undefined)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </Field>

      <Field
        name="password"
        validators={{
          onChange: userSchema.shape.password,
        }}
      >
        {(field) => (
          <TextField
            label="Passwort"
            type="password"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value || undefined)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </Field>

      <Field
        name="passwordConfirmation"
        validators={{
          onChange: (field) => {
            if (field.value !== field.fieldApi.form.getFieldValue("password")) {
              return "Passwörter stimmen nicht überein";
            }
            return null;
          },
        }}
      >
        {(field) => (
          <TextField
            label="Passwort bestätigen"
            type="password"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value || undefined)}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </Field>

      <Field
        name="salutation"
        validators={{
          onChange: userSchema.shape.title,
        }}
      >
        {(field) => (
          <SelectField
            label="Anrede"
            options={SALUTATIONS}
            emptyLabel="Keine Anrede"
            valueId={field.state.value}
            onChange={(value) => field.handleChange(value)}
            getOptionId={(option) => option}
            getOptionLabel={(option) => option}
            error={field.state.meta.errors.join(", ")}
          />
        )}
      </Field>

      <Field
        name="abbrv"
        validators={{
          onChange: userSchema.shape.abbrv,
        }}
      >
        {(field) => (
          <TextField
            label="Kürzel"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(value) => field.handleChange(value || undefined)}
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
