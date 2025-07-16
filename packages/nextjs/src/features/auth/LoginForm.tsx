"use client";

import { useForm } from "@tanstack/react-form";

import { Button } from "~/components/form/Button";
import { TextField } from "~/components/form/TextField";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";
import { setSessionToken } from "./serverActions/setSessionToken";

export const LoginForm = () => {
  const loginMutation = api.auth.login.useMutation();

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value, formApi }) => {
      const { email, password } = value;
      const response = await loginMutation.mutateAsync({ email, password }).catch(() => null);

      if (!response) {
        return;
      }

      if (response.error) {
        formApi.setFieldMeta(response.error.field, {
          errors: [],
          isTouched: false,
          errorMap: {
            onSubmit: response.error.message,
          },
          isValidating: false,
          isPristine: true,
          isDirty: false,
          isBlurred: false,
          errorSourceMap: {},
        });

        return;
      }

      const newSessionToken = response.session.token;
      await setSessionToken(newSessionToken);
    },
  });

  return (
    <form className="flex flex-col gap-4" onSubmit={submitHandler(() => form.handleSubmit())}>
      <form.Field name="email">
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
      </form.Field>

      <form.Field name="password">
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
      </form.Field>

      {loginMutation.isError && <p className="text-danger">{loginMutation.error.message}</p>}

      <Button type="submit">Anmelden</Button>
    </form>
  );
};
