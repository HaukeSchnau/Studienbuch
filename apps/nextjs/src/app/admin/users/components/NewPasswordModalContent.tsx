import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { z } from "zod";

import { generateRandomPassword } from "@schnau/lib/src/auth/generateRandomPassword";
import { formalName } from "@schnau/lib/src/users/teacher";

import type { User } from "../user.type";
import { Button } from "~/components/form/Button";
import { TextField } from "~/components/form/TextField";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";

interface ChangePasswordModalContentProps {
  user: User;
  onClose: () => void;
}

export const ChangePasswordModalContent = ({
  user,
  onClose,
}: ChangePasswordModalContentProps) => {
  const updatePasswordMutation = api.users.updatePassword.useMutation({
    onSuccess: () => {
      onClose();
    },
  });

  const { Field, Subscribe, handleSubmit } = useForm({
    defaultValues: {
      password: "",
      passwordRepeat: "",
    },
    onSubmit: async ({ value }) => {
      updatePasswordMutation.mutate({
        id: user.id,
        password: value.password,
      });
    },
    validators: {
      onChange: ({ value: { password, passwordRepeat } }) => {
        if (password !== passwordRepeat) {
          return "Passwörter stimmen nicht überein";
        }
      },
    },
  });

  return (
    <form onSubmit={submitHandler(handleSubmit)}>
      <h1 className="text-2xl font-bold text-green-text">
        Passwort von {formalName(user)} ändern
      </h1>

      <div className="h-4" />

      <Field
        name="password"
        validatorAdapter={zodValidator}
        validators={{
          onChange: z
            .string()
            .min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
        }}
      >
        {(field) => (
          <TextField
            type="password"
            label="Neues Passwort"
            value={field.getValue()}
            error={field.getMeta().errors.join(", ")}
            onChange={(value) => field.handleChange(value)}
            onBlur={field.handleBlur}
            required
            actions={[
              {
                icon: "content_copy",
                onClick: () => {
                  void navigator.clipboard.writeText(field.getValue());
                },
              },
              {
                icon: "shuffle",
                onClick: () => {
                  const randomPassword = generateRandomPassword();
                  field.form.setFieldValue("password", randomPassword);
                  field.form.setFieldValue("passwordRepeat", randomPassword);
                  void field.validate("change");
                },
              },
            ]}
          />
        )}
      </Field>

      <div className="h-4" />

      <Field name="passwordRepeat">
        {(field) => (
          <TextField
            type="password"
            label="Neues Passwort (Wiederholung)"
            value={field.getValue()}
            error={field.getMeta().errors.join(", ")}
            onChange={(value) => field.handleChange(value)}
            onBlur={field.handleBlur}
            required
          />
        )}
      </Field>

      <div className="h-4" />

      <Subscribe selector={(form) => form.errors}>
        {(error) => <div className="text-red">{error.join(", ")}</div>}
      </Subscribe>

      {updatePasswordMutation.isError && (
        <div className="text-red">{updatePasswordMutation.error.message}</div>
      )}

      <div className="h-4" />

      <Subscribe
        selector={(form) =>
          !!form.errors.length ||
          form.isSubmitting ||
          updatePasswordMutation.isPending
        }
      >
        {(disabled) => (
          <Button type="submit" disabled={disabled}>
            Speichern
          </Button>
        )}
      </Subscribe>
    </form>
  );
};
