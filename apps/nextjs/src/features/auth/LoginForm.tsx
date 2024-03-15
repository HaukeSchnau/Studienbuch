"use client";

import { createFormFactory } from "@tanstack/react-form";

import { Button } from "~/components/form/Button";
import { TextField } from "~/components/form/TextField";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";
import { setJwt } from "./serverActions/setJwt";

interface LoginFormValues {
  email: string;
  password: string;
}

const formFactory = createFormFactory<LoginFormValues>({
  defaultValues: {
    email: "",
    password: "",
  },
});

export const LoginForm = () => {
  const loginMutation = api.auth.login.useMutation();

  const { Field, handleSubmit } = formFactory.useForm({
    onSubmit: async ({ value, formApi }) => {
      const { email, password } = value;
      const response = await loginMutation
        .mutateAsync({ email, password })
        .catch(() => null);

      if (!response) {
        return;
      }

      if (response.error) {
        formApi.setFieldMeta(response.error.field, {
          errors: [],
          isTouched: false,
          touchedErrors: [],
          errorMap: {
            onSubmit: response.error.message,
          },
          isValidating: false,
        });

        return;
      }

      const newSessionToken = response.sessionToken;
      await setJwt(newSessionToken);
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={submitHandler(handleSubmit)}
    >
      <Field name="email">
        {(field) => (
          <TextField
            label="Email"
            type="email"
            value={field.state.value}
            onBlur={field.handleBlur}
            required
            onChange={(value) => field.handleChange(value)}
            error={field.state.meta.errors.join(",")}
          />
        )}
      </Field>

      <Field name="password">
        {(field) => (
          <TextField
            label="Passwort"
            type="password"
            value={field.state.value}
            onBlur={field.handleBlur}
            required
            onChange={(value) => field.handleChange(value)}
            error={field.state.meta.errors.join(",")}
          />
        )}
      </Field>

      {loginMutation.isError && (
        <p className="text-error">
          {loginMutation.error?.message ?? "Ein Fehler ist aufgetreten"}
        </p>
      )}

      <Button type="submit">Anmelden</Button>
    </form>
  );
};
