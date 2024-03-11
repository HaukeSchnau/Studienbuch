"use client";

import { useRouter } from "next/navigation";
import { createFormFactory } from "@tanstack/react-form";

import { Button } from "~/components/form/Button";
import { TextField } from "~/components/form/TextField";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";

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
  const router = useRouter();

  const { Provider, Field, handleSubmit } = formFactory.useForm({
    onSubmit: async ({ value, formApi }) => {
      const { email, password } = value;
      const response = await loginMutation
        .mutateAsync({ email, password })
        .catch(() => null);

      if (!response) {
        return;
      }

      if (response.error) {
        console.log(response.error);

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

      document.cookie = `jwt=${newSessionToken}; path=/`;

      setTimeout(() => {
        void router.replace("/admin");
      }, 500);
    },
  });

  return (
    <Provider>
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
    </Provider>
  );
};
