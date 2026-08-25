import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthError, AuthShell, Field } from "#/features/auth/auth-shell.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

export const Route = createFileRoute("/passwort-vergessen")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "Passwort vergessen | Studienbuch" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/passwort-zuruecksetzen`,
    });
    setBusy(false);
    if (result.error !== null) {
      setError("Die Nachricht konnte nicht gesendet werden. Versuche es später noch einmal.");
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Passwort zurücksetzen</h1>
      {sent ? (
        <p className="mt-4 text-center text-ink-soft">
          Falls ein Konto zu dieser Adresse gehört, haben wir einen Link geschickt.
        </p>
      ) : (
        <form className="mt-7 grid gap-4" onSubmit={submit}>
          <Field label="E-Mail-Adresse">
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </Field>
          {error === undefined ? null : <AuthError>{error}</AuthError>}
          <Button disabled={busy} radius="pill" size="xl" type="submit" variant="brand">
            Link senden
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
