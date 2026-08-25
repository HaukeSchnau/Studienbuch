import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import { saveProfile } from "#/features/auth/access.ts";
import { AuthError, AuthShell, Field } from "#/features/auth/auth-shell.tsx";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({ access: Schema.String });

export const Route = createFileRoute("/einrichten")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: SetupPage,
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
    try {
      const saved = await saveProfile({ schoolAccessId: access, displayName, cohort, className });
      if (!saved.ok) {
        setError("Das Profil konnte nicht gespeichert werden.");
        setBusy(false);
        return;
      }
      await navigate({ to: "/app" });
    } catch {
      setError("Das Profil konnte nicht gespeichert werden.");
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Dein Studienbuch</h1>
      <p className="mt-3 text-center text-ink-soft">
        Diese Angaben bestimmst nur du. Du kannst sie später ändern.
      </p>
      <form className="mt-7 grid gap-4" onSubmit={submit}>
        <Field label="Name">
          <Input
            autoComplete="name"
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </Field>
        <Field label="Jahrgang, optional">
          <Input
            onChange={(event) => setCohort(event.target.value)}
            placeholder="zum Beispiel 8"
            value={cohort}
          />
        </Field>
        <Field label="Klasse, optional">
          <Input
            onChange={(event) => setClassName(event.target.value)}
            placeholder="zum Beispiel 8a"
            value={className}
          />
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button disabled={busy} radius="pill" size="xl" type="submit" variant="brand">
          Fertig
        </Button>
      </form>
    </AuthShell>
  );
}
