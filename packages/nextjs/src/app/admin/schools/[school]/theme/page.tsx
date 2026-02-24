/* oxlint-disable @typescripttypescript/no-unnecessary-condition */
"use client";

import type { SchoolId } from "@stu/lib";
import { useForm } from "@tanstack/react-form";
import { useRef } from "react";

import { Button } from "~/components/form/Button";
import { IconButton } from "~/components/form/IconButton";
import { Card } from "~/components/layout/Card";
import { Grid } from "~/components/layout/Grid";
import { PageHeading } from "~/components/layout/PageHeading";
import { submitHandler } from "~/infrastructure/forms/submitHandler";
import { api } from "~/infrastructure/trpc/react";

export default function ThemePage({
  params,
}: {
  params: {
    school: SchoolId;
  };
}) {
  const query = api.schools.getTheme.useQuery(params.school);
  const saveMutation = api.management.schools.setTheme.useMutation({
    onSuccess: () => {
      void query.refetch();
    },
  });

  const { Field, handleSubmit } = useForm({
    defaultValues: query.data,
    onSubmit: async ({ value: { image, theme } }) => {
      await saveMutation.mutateAsync({
        school: params.school,
        theme,
        image,
      });
    },
  });

  return (
    <form onSubmit={submitHandler(handleSubmit)}>
      <div className="flex justify-between pb-4">
        <PageHeading color="white">Theme</PageHeading>

        <Button type="submit">Speichern</Button>
      </div>

      <Grid>
        <Card>
          <Field name="theme.primary.default">
            {(field) => <ColorField field={field} label="Primary Default" cssVar="--primary" onCssVar="--on-primary" />}
          </Field>

          <Field name="theme.primary.pale">
            {(field) => (
              <ColorField field={field} label="Primary Pale" cssVar="--primary-pale" onCssVar="--on-primary-pale" />
            )}
          </Field>

          <Field name="theme.primary.des">
            {(field) => (
              <ColorField
                field={field}
                label="Primary Desaturated"
                cssVar="--primary-des"
                onCssVar="--on-primary-des"
              />
            )}
          </Field>
        </Card>

        <Card>
          <Field name="theme.accent.default">
            {(field) => <ColorField field={field} label="Accent Default" cssVar="--accent" onCssVar="--on-accent" />}
          </Field>

          <Field name="theme.accent.sec">
            {(field) => (
              <ColorField field={field} label="Accent Secondary" cssVar="--accent-sec" onCssVar="--on-accent-sec" />
            )}
          </Field>

          <Field name="theme.accent.pale">
            {(field) => (
              <ColorField field={field} label="Accent Pale" cssVar="--accent-pale" onCssVar="--on-accent-pale" />
            )}
          </Field>

          <Field name="theme.accent.des">
            {(field) => (
              <ColorField field={field} label="Accent Desaturated" cssVar="--accent-des" onCssVar="--on-accent-des" />
            )}
          </Field>
        </Card>

        <Card>
          <Field name="theme.danger.default">
            {(field) => <ColorField field={field} label="Danger Default" cssVar="--danger" onCssVar="--on-danger" />}
          </Field>

          <Field name="theme.danger.sec">
            {(field) => (
              <ColorField field={field} label="Danger Secondary" cssVar="--danger-sec" onCssVar="--on-danger-sec" />
            )}
          </Field>

          <Field name="theme.danger.des">
            {(field) => (
              <ColorField field={field} label="Danger Desaturated" cssVar="--danger-des" onCssVar="--on-danger-des" />
            )}
          </Field>
        </Card>

        <Card>
          <Field name="theme.alert.default">
            {(field) => <ColorField field={field} label="Alert Default" cssVar="--alert" onCssVar="--on-alert" />}
          </Field>

          <Field name="theme.alert.des">
            {(field) => (
              <ColorField field={field} label="Alert Desaturated" cssVar="--alert-des" onCssVar="--on-alert-des" />
            )}
          </Field>
        </Card>

        <Card>
          <Field name="theme.success.default">
            {(field) => <ColorField field={field} label="Success Default" cssVar="--success" onCssVar="--on-success" />}
          </Field>

          <Field name="theme.success.pale">
            {(field) => (
              <ColorField field={field} label="Success Pale" cssVar="--success-pale" onCssVar="--on-success-pale" />
            )}
          </Field>

          <Field name="theme.success.des">
            {(field) => (
              <ColorField
                field={field}
                label="Success Desaturated"
                cssVar="--success-des"
                onCssVar="--on-success-des"
              />
            )}
          </Field>
        </Card>

        <Card>
          <Field name="theme.neutral.default">
            {(field) => <ColorField field={field} label="Neutral Default" cssVar="--neutral" onCssVar="--on-neutral" />}
          </Field>

          <Field name="theme.neutral.sec">
            {(field) => (
              <ColorField field={field} label="Neutral Secondary" cssVar="--neutral-sec" onCssVar="--on-neutral-sec" />
            )}
          </Field>
        </Card>

        <Card>
          <Field name="theme.surface.default">
            {(field) => <ColorField field={field} label="Surface Default" cssVar="--surface" onCssVar="--on-surface" />}
          </Field>

          <Field name="theme.primary.text">
            {(field) => <TextColorField field={field} label="Primary Text" cssVar="--primary-text" />}
          </Field>
        </Card>

        <Card>
          <Field name="theme.background.default">
            {(field) => (
              <ColorField field={field} label="Background Default" cssVar="--background" onCssVar="--on-background" />
            )}
          </Field>
        </Card>
      </Grid>
    </form>
  );
}

interface GenericField<T> {
  getValue: () => T;
  setValue: (value: T) => void;
}

const ColorField = ({
  field,
  label,
  cssVar,
  onCssVar,
}: {
  field: GenericField<{
    color: string;
    on: string;
  }>;
  label: string;
  cssVar: string;
  onCssVar: string;
}) => {
  const onField = useRef<HTMLInputElement>(null);
  const changeHandler = (value: { color: string; on: string }) => {
    document.documentElement.style.setProperty(cssVar, value.color);
    document.documentElement.style.setProperty(onCssVar, value.on);
    field.setValue(value);
  };

  const value = field.getValue();

  if (!value) {
    return null;
  }

  return (
    <div className="relative p-8">
      <input
        type="color"
        className="absolute left-0 top-0 h-full w-full"
        value={value.color ?? "#000000"}
        onChange={(e) =>
          changeHandler({
            color: e.target.value,
            on: value.on,
          })
        }
      />

      <div className="pointer-events-none relative flex items-center justify-between">
        <label
          className="font-medium"
          style={{
            color: value.on ?? "#FFFFFF",
          }}
        >
          {label}
        </label>

        <input
          type="color"
          value={value.on ?? "#FFFFFF"}
          onChange={(e) =>
            changeHandler({
              color: value.color,
              on: e.target.value,
            })
          }
          hidden
          ref={onField}
        />

        <IconButton
          onClick={() => onField.current?.click()}
          icon="format_color_text"
          className="pointer-events-auto"
          style={{
            color: value.on ?? "#FFFFFF",
          }}
        />
      </div>
    </div>
  );
};

const TextColorField = ({ field, label, cssVar }: { field: GenericField<string>; label: string; cssVar: string }) => {
  const onField = useRef<HTMLInputElement>(null);
  const changeHandler = (value: string) => {
    document.documentElement.style.setProperty(cssVar, value);
    field.setValue(value);
  };

  const value = field.getValue();

  if (!value) {
    return null;
  }

  return (
    <div className="relative p-8">
      <div className="pointer-events-none relative flex items-center justify-between">
        <label
          className="font-medium"
          style={{
            color: value ?? "#FFFFFF",
          }}
        >
          {label}
        </label>

        <input
          type="color"
          value={value ?? "#FFFFFF"}
          onChange={(e) => changeHandler(e.target.value)}
          hidden
          ref={onField}
        />

        <IconButton
          onClick={() => onField.current?.click()}
          icon="format_color_text"
          className="pointer-events-auto"
          style={{
            color: value ?? "#FFFFFF",
          }}
        />
      </div>
    </div>
  );
};
