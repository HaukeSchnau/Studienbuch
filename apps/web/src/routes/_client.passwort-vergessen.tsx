import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AuthDone,
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
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

export const Route = createFileRoute("/_client/passwort-vergessen")({
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
      {sent ? (
        <AuthDone title="Unterwegs zu dir">
          Falls ein Konto zu dieser Adresse gehört, haben wir einen Link geschickt.
        </AuthDone>
      ) : (
        <>
          <AuthHeading>Passwort vergessen?</AuthHeading>
          <form className="mt-7 grid gap-4" onSubmit={submit}>
            <Field label="E-Mail-Adresse">
              <Input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
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
              {busy ? <Working>Wird gesendet ...</Working> : "Link senden"}
            </Button>
          </form>
        </>
      )}
      <AuthNote>
        <Link className={authNoteLinkClass} search={{}} to="/anmelden">
          Zurück zur Anmeldung
        </Link>
      </AuthNote>
    </AuthShell>
  );
}
