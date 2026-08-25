import { Organization } from "@stu/core/organization";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import { saveProfile } from "#/features/auth/access.ts";
import {
  AuthError,
  AuthHeading,
  AuthShell,
  Field,
  invalidWhen,
  submitState,
  Working,
} from "#/features/auth/auth-shell.tsx";
import { accessMessage } from "#/features/auth/messages.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({ access: Schema.String });

export const Route = createFileRoute("/einrichten")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: SetupPage,
  head: () => ({ meta: [{ title: "Profil einrichten | Studienbuch" }] }),
});

function SetupPage() {
  const { access } = Route.useSearch();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [cohort, setCohort] = useState("");
  const [className, setClassName] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const saved = await saveProfile({ schoolAccessId: access, displayName, cohort, className });
    if (!saved.ok) {
      setError(accessMessage(saved.error));
      setBusy(false);
      return;
    }
    await navigate({ to: "/app", replace: true });
  };

  return (
    <AuthShell>
      <AuthHeading>Fast fertig</AuthHeading>
      <p className="enter-later mt-4 text-center text-ink-soft">
        Wie sollen wir dich nennen? Das bestimmst nur du, und du kannst es später ändern.
      </p>
      <form className="mt-7 grid gap-4" onSubmit={submit}>
        <Field label="Name">
          <Input
            autoComplete="name"
            maxLength={Organization.profileFieldMaxLength}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
            {...invalidWhen(error)}
          />
        </Field>
        <Field label="Jahrgang, optional">
          <Input
            maxLength={Organization.profileFieldMaxLength}
            onChange={(event) => setCohort(event.target.value)}
            placeholder="zum Beispiel 8"
            value={cohort}
            {...invalidWhen(error)}
          />
        </Field>
        <Field label="Klasse, optional">
          <Input
            maxLength={Organization.profileFieldMaxLength}
            onChange={(event) => setClassName(event.target.value)}
            placeholder="zum Beispiel 8a"
            value={className}
            {...invalidWhen(error)}
          />
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button
          radius="pill"
          size="xl"
          type="submit"
          variant="brand"
          {...submitState({ busy, error })}
        >
          {busy ? <Working>Wird gespeichert ...</Working> : "Los geht's"}
        </Button>
      </form>
    </AuthShell>
  );
}
