"use client";

import { useRef } from "react";
import { useForm } from "@tanstack/react-form";

import { IconButton } from "~/components/form/IconButton";
import { Card } from "~/components/layout/Card";
import { Grid } from "~/components/layout/Grid";
import { api } from "~/infrastructure/trpc/react";

export default function ThemePage({
  params,
}: {
  params: {
    school: string;
  };
}) {
  const query = api.schools.getTheme.useQuery(parseInt(params.school));
  const { Field } = useForm({
    defaultValues: query.data,
  });

  return (
    <Grid>
      <Card>
        <Field name="primary.default">
          {(field) => (
            <ColorField
              field={field}
              label="Primary Default"
              cssVar="--primary"
              onCssVar="--on-primary"
            />
          )}
        </Field>

        <Field name="primary.pale">
          {(field) => (
            <ColorField
              field={field}
              label="Primary Pale"
              cssVar="--primary-pale"
              onCssVar="--on-primary-pale"
            />
          )}
        </Field>

        <Field name="primary.des">
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
        <Field name="accent.default">
          {(field) => (
            <ColorField
              field={field}
              label="Accent Default"
              cssVar="--accent"
              onCssVar="--on-accent"
            />
          )}
        </Field>

        <Field name="accent.sec">
          {(field) => (
            <ColorField
              field={field}
              label="Accent Secondary"
              cssVar="--accent-sec"
              onCssVar="--on-accent-sec"
            />
          )}
        </Field>

        <Field name="accent.pale">
          {(field) => (
            <ColorField
              field={field}
              label="Accent Pale"
              cssVar="--accent-pale"
              onCssVar="--on-accent-pale"
            />
          )}
        </Field>

        <Field name="accent.des">
          {(field) => (
            <ColorField
              field={field}
              label="Accent Desaturated"
              cssVar="--accent-des"
              onCssVar="--on-accent-des"
            />
          )}
        </Field>
      </Card>

      <Card>
        <Field name="danger.default">
          {(field) => (
            <ColorField
              field={field}
              label="Danger Default"
              cssVar="--danger"
              onCssVar="--on-danger"
            />
          )}
        </Field>

        <Field name="danger.sec">
          {(field) => (
            <ColorField
              field={field}
              label="Danger Secondary"
              cssVar="--danger-sec"
              onCssVar="--on-danger-sec"
            />
          )}
        </Field>

        <Field name="danger.des">
          {(field) => (
            <ColorField
              field={field}
              label="Danger Desaturated"
              cssVar="--danger-des"
              onCssVar="--on-danger-des"
            />
          )}
        </Field>
      </Card>

      <Card>
        <Field name="alert.default">
          {(field) => (
            <ColorField
              field={field}
              label="Alert Default"
              cssVar="--alert"
              onCssVar="--on-alert"
            />
          )}
        </Field>

        <Field name="alert.des">
          {(field) => (
            <ColorField
              field={field}
              label="Alert Desaturated"
              cssVar="--alert-des"
              onCssVar="--on-alert-des"
            />
          )}
        </Field>
      </Card>

      <Card>
        <Field name="success.default">
          {(field) => (
            <ColorField
              field={field}
              label="Success Default"
              cssVar="--success"
              onCssVar="--on-success"
            />
          )}
        </Field>

        <Field name="success.pale">
          {(field) => (
            <ColorField
              field={field}
              label="Success Pale"
              cssVar="--success-pale"
              onCssVar="--on-success-pale"
            />
          )}
        </Field>

        <Field name="success.des">
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
        <Field name="neutral.default">
          {(field) => (
            <ColorField
              field={field}
              label="Neutral Default"
              cssVar="--neutral"
              onCssVar="--on-neutral"
            />
          )}
        </Field>

        <Field name="neutral.sec">
          {(field) => (
            <ColorField
              field={field}
              label="Neutral Secondary"
              cssVar="--neutral-sec"
              onCssVar="--on-neutral-sec"
            />
          )}
        </Field>
      </Card>

      <Card>
        <Field name="surface.default">
          {(field) => (
            <ColorField
              field={field}
              label="Surface Default"
              cssVar="--surface"
              onCssVar="--on-surface"
            />
          )}
        </Field>

        <Field name="primary.text">
          {(field) => (
            <TextColorField
              field={field}
              label="Primary Text"
              cssVar="--primary-text"
            />
          )}
        </Field>
      </Card>

      <Card>
        <Field name="background.default">
          {(field) => (
            <ColorField
              field={field}
              label="Background Default"
              cssVar="--background"
              onCssVar="--on-background"
            />
          )}
        </Field>
      </Card>
    </Grid>
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

const TextColorField = ({
  field,
  label,
  cssVar,
}: {
  field: GenericField<string>;
  label: string;
  cssVar: string;
}) => {
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
