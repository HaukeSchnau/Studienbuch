import { useForm } from "@tanstack/react-form";

import type { Permission, Salutation, ScopeOption } from "@stu/lib";
import { formalName } from "@stu/lib";

import type { User } from "../user.type";
import { Button } from "~/components/form/Button";
import { SelectField } from "~/components/form/SelectField";
import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";

interface Props {
  user: User;
  onClose: () => void;
}

const scopeOptionLabels = {
  schools: "Schulen",
  years: "Jahrgänge",
  classes: "Klassen",
  courses: "Kurse",
} as const;

interface PermissionMeta {
  description: string;
  scopeOptions?: ScopeOption[];
}

const availablePermissions = new Map<Permission, PermissionMeta>([
  ["EDIT_INFO_PAGES", { description: "Infoseiten bearbeiten" }],
  ["EDIT_USERS", { description: "Benutzer verwalten" }],
  [
    "EDIT_COURSES",
    {
      description: "Kurse verwalten",
      scopeOptions: ["schools", "years", "classes"],
    },
  ],
  [
    "EDIT_YEARS",
    { description: "Jahrgänge verwalten", scopeOptions: ["schools"] },
  ],
  [
    "EDIT_CLASSES",
    { description: "Klassen verwalten", scopeOptions: ["schools", "years"] },
  ],
  ["EDIT_SCHOOLS", { description: "Schulen verwalten" }],
  ["VIEW_LOGS", { description: "Logs einsehen" }],
]);

export const PermissionsModalContent = ({ user, onClose }: Props) => {
  const setPermissionsMutation =
    api.management.users.setPermissions.useMutation({
      onSuccess: () => {
        onClose();
      },
    });

  const { Field, handleSubmit } = useForm({
    defaultValues: {
      permissions: user.permissions,
      isSuperUser: user.isSuperUser,
    },
    onSubmit: async ({ value }) => {
      await setPermissionsMutation.mutateAsync({
        userId: user.id,
        permissions: value.permissions,
        isSuperUser: value.isSuperUser,
      });
    },
  });

  return (
    <form onSubmit={submitHandler(handleSubmit)}>
      <h2 className="text-xl font-bold text-primary-text">
        Berechtigungen von {formalName(user.person)} bearbeiten
      </h2>
      <Field name="isSuperUser">
        {(field) => (
          <label>
            <input
              type="checkbox"
              className="mr-2"
              checked={field.getValue()}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.checked)}
            />
            Admin
          </label>
        )}
      </Field>

      <Field name="permissions">
        {(field) => (
          <div className="flex flex-col">
            {field.getValue().map(({ permission }, index) => (
              <>
                <hr className="my-4 opacity-30" />
                <div
                  key={permission}
                  className="flex items-start justify-between"
                >
                  <Field name={`permissions[${index}].scope`}>
                    {(scopeField) => (
                      <ScopesField
                        permission={permission}
                        scope={scopeField.getValue() ?? {}}
                        onSetScopeOption={(option, id, value) =>
                          scopeField.setValue({
                            ...scopeField.getValue(),
                            [option]: value
                              ? [...(scopeField.getValue()?.[option] ?? []), id]
                              : (scopeField.getValue()?.[option] ?? []).filter(
                                  (i) => i !== id,
                                ),
                          })
                        }
                      />
                    )}
                  </Field>
                  <Button
                    onClick={() => field.removeValue(index)}
                    variant="danger"
                  >
                    ✕
                  </Button>
                </div>
              </>
            ))}
            <SelectField
              options={Array.from(availablePermissions)
                .filter(
                  ([permission]) =>
                    !field.getValue().some((p) => p.permission === permission),
                )
                .map(([permission, meta]) => ({
                  value: permission,
                  label: meta.description,
                }))}
              onChange={(value) => {
                if (value) {
                  field.pushValue({
                    permission: value.value,
                    scope: null,
                  });
                }
              }}
              emptyLabel="Berechtigung hinzufügen"
              getOptionId={(option) => option.value}
              getOptionLabel={(option) => option.label}
            />
          </div>
        )}
      </Field>

      <div className="flex justify-end gap-4 pt-4">
        <Button onClick={onClose} variant="secondary">
          Abbrechen
        </Button>
        <Button type="submit" disabled={setPermissionsMutation.isPending}>
          Speichern
        </Button>
      </div>
    </form>
  );
};

interface ScopesFieldProps {
  permission: Permission;
  scope: Partial<Record<ScopeOption, number[]>>;
  onSetScopeOption: (scope: ScopeOption, id: number, value: boolean) => void;
}

const ScopesField = ({
  permission,
  onSetScopeOption,
  scope,
}: ScopesFieldProps) => {
  const meta = availablePermissions.get(permission);

  if (!meta) {
    throw new Error(`No meta for permission ${permission} found`);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="text-lg font-medium">{meta.description}</div>

      {meta.scopeOptions?.map((option) => (
        <ScopeField
          key={option}
          option={option}
          selectedOptions={scope[option] ?? []}
          onSetScopeOption={(id, value) => onSetScopeOption(option, id, value)}
        />
      ))}
    </div>
  );
};

interface ScopeFieldProps {
  option: ScopeOption;
  selectedOptions: number[];
  onSetScopeOption: (id: number, value: boolean) => void;
}

const ScopeField = ({
  option,
  selectedOptions,
  onSetScopeOption,
}: ScopeFieldProps) => {
  const {
    data: options,
    isPending,
    isError,
    error,
  } = api.management.users.listScopeOptions.useQuery(option);

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <div>{error.message}</div>;
  }

  return (
    <div className="flex flex-col">
      {/* <div className="underline">{scopeOptionLabels[option]}</div>
      <div className="flex flex-col">
        {options.map((option) => (
          <label key={option.id}>
            <input
              type="checkbox"
              className="mr-2"
              checked={selectedOptions.includes(option.id)}
              onChange={(e) => onSetScopeOption(option.id, e.target.checked)}
              disabled={
                !selectedOptions.includes(option.id) &&
                selectedOptions.length === options.length - 1
              }
            />
            {option.name}
          </label>
        ))}
      </div> */}
    </div>
  );
};
