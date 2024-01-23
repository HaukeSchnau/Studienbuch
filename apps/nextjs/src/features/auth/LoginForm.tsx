"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { SubmitHandler } from "react-hook-form";

import { Button } from "~/components/form/Button";
import { TextField } from "~/components/form/TextField";
import { api } from "~/utils/api";

export interface LoginForm {
  email: string;
  password: string;
}

export const LoginForm = () => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    clearErrors,
  } = useForm<LoginForm>({
    defaultValues: {
      email: "hauke@schnau-lilienthal.de",
      password: "kiara2705",
    },
  });
  const loginMutation = api.auth.login.useMutation();
  const router = useRouter();

  const onSubmit: SubmitHandler<LoginForm> = async ({ email, password }) => {
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
