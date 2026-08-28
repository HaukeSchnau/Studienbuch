import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import {
  AuthError,
  AuthHeading,
  AuthNote,
  authNoteLinkClass,
  AuthShell,
  Field,
  invalidWhen,
  submitState,
  Working,
} from "#/features/auth/auth-shell.tsx";
import { betterAuthMessage } from "#/features/auth/messages.ts";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({
  token: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});

export const Route = createFileRoute("/_client/passwort-zuruecksetzen")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Neues Passwort | Studienbuch" }] }),
});

function ResetPasswordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const token = search.token;
  const usable = token !== undefined && search.error === undefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (token === undefined) return;
    setBusy(true);
    setError(undefined);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setBusy(false);
    if (result.error !== null) {
      setError(
        betterAuthMessage(result.error, "Der Link ist abgelaufen oder wurde bereits verwendet."),
      );
      return;
    }
    await navigate({ to: "/anmelden", search: {}, replace: true });
  };

  if (!usable) {
    return (
      <AuthShell>
        <AuthHeading>Neues Passwort</AuthHeading>
        <div className="mt-6">
          <AuthError>Der Link ist ungültig oder abgelaufen.</AuthError>
        </div>
        <Button asChild className="mt-7 w-full" size="xl" variant="brand">
          <Link to="/passwort-vergessen">Neuen Link anfordern</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading>Neues Passwort</AuthHeading>
      <form className="mt-7 grid gap-4" onSubmit={submit}>
        <Field hint="Mindestens acht Zeichen." label="Neues Passwort">
          <Input
            autoComplete="new-password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
            {...invalidWhen(error)}
          />
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button size="xl" type="submit" variant="brand" {...submitState({ busy, error })}>
          {busy ? <Working>Wird gespeichert ...</Working> : "Passwort speichern"}
        </Button>
      </form>
      <AuthNote>
        <Link className={authNoteLinkClass} search={{}} to="/anmelden">
          Zurück zur Anmeldung
        </Link>
      </AuthNote>
    </AuthShell>
  );
}
