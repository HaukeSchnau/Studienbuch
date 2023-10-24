"use client";

import { useRouter } from "next/navigation";
import type { SubmitHandler } from "react-hook-form";

import { useLoginForm } from "@acme/react-shared";
import type { LoginForm as LoginFormData } from "@acme/react-shared";

import { Button } from "~/components/Button";
import { TextField } from "~/components/form/TextField";
import { api } from "~/utils/api";

export const LoginForm = () => {
  const { register, handleSubmit, setError, errors, clearErrors } =
    useLoginForm();
  const loginMutation = api.auth.login.useMutation();
  const router = useRouter();

  const onSubmit: SubmitHandler<LoginFormData> = async ({
    email,
    password,
  }) => {
    clearErrors();

    const response = await loginMutation
      .mutateAsync({ email, password })
      .catch(() => null);

    if (!response) {
      return;
    }

    if (response.error) {
      console.log(response.error);

      setError(response.error.field, {
        message: response.error.message,
      });

      return;
    }

    const newSession = response.session;

    document.cookie = `session=${newSession.id}; path=/`;
    sessionStorage.setItem("session", JSON.stringify(newSession));
    void router.replace("/admin");
  };

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <TextField
        label="Email"
        type="email"
        {...register("email")}
        error={errors.email?.message}
        required
      />
      <TextField
        label="Passwort"
        type="password"
        {...register("password")}
        error={errors.password?.message}
        required
      />

      {loginMutation.isError && (
        <p className="text-error">
          {loginMutation.error?.message ?? "Ein Fehler ist aufgetreten"}
        </p>
      )}

      <Button type="submit">Anmelden</Button>
    </form>
  );
};
