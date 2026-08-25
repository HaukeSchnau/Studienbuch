import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import { AuthError, AuthShell, Field } from "#/features/auth/auth-shell.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({
  token: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
});

export const Route = createFileRoute("/passwort-zuruecksetzen")({
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (search.token === undefined) return;
    setBusy(true);
    setError(undefined);
    const result = await authClient.resetPassword({ newPassword: password, token: search.token });
    setBusy(false);
    if (result.error !== null) {
      setError("Der Link ist abgelaufen oder wurde bereits verwendet.");
      return;
    }
    await navigate({ to: "/anmelden", search: {}, replace: true });
  };

  const invalid = search.token === undefined || search.error !== undefined;
  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Neues Passwort</h1>
      {invalid ? (
        <AuthError>Der Link ist ungültig oder abgelaufen.</AuthError>
      ) : (
        <form className="mt-7 grid gap-4" onSubmit={submit}>
          <Field label="Neues Passwort">
            <Input
              autoComplete="new-password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </Field>
          {error === undefined ? null : <AuthError>{error}</AuthError>}
          <Button disabled={busy} radius="pill" size="xl" type="submit" variant="brand">
            Passwort speichern
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
