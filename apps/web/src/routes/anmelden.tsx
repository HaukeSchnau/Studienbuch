import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import { AuthError, AuthShell, Field } from "#/features/auth/auth-shell.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({ reservation: Schema.optional(Schema.String) });

export const Route = createFileRoute("/anmelden")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: SignInPage,
  head: () => ({ meta: [{ title: "Anmelden | Studienbuch" }] }),
});

function SignInPage() {
  const { reservation } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const destination =
    reservation === undefined
      ? "/app"
      : `/aktivieren/abschliessen?reservation=${encodeURIComponent(reservation)}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: `${window.location.origin}${destination}`,
    });
    setBusy(false);
    if (result.error !== null) {
      setError(
        result.error.status === 403
          ? "Bestätige zuerst deine E-Mail-Adresse. Wir haben dir einen neuen Link geschickt."
          : "E-Mail-Adresse oder Passwort stimmen nicht.",
      );
      return;
    }
    window.location.assign(destination);
  };

  const signInWithPasskey = async () => {
    setError(undefined);
    const result = await authClient.signIn.passkey();
    if (result.error !== null) {
      setError("Der Passkey konnte nicht verwendet werden.");
      return;
    }
    await navigate({
      to: reservation === undefined ? "/app" : "/aktivieren/abschliessen",
      search: reservation === undefined ? {} : { reservation },
    });
  };

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Anmelden</h1>
      <form className="mt-7 grid gap-4" onSubmit={submit}>
        <Field label="E-Mail-Adresse">
          <Input
            autoComplete="username webauthn"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </Field>
        <Field label="Passwort">
          <Input
            autoComplete="current-password webauthn"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button disabled={busy} radius="pill" size="xl" type="submit" variant="brand">
          {busy ? "Anmeldung läuft ..." : "Anmelden"}
        </Button>
      </form>
      <a
        className="mt-4 block text-center text-sm font-semibold text-accent hover:underline"
        href="/passwort-vergessen"
      >
        Passwort vergessen?
      </a>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
        <span className="h-px grow bg-neutral-sec" />
        oder
        <span className="h-px grow bg-neutral-sec" />
      </div>
      <Button
        className="w-full"
        onClick={() => void signInWithPasskey()}
        radius="pill"
        size="lg"
        type="button"
        variant="outline"
      >
        Mit Passkey anmelden
      </Button>
    </AuthShell>
  );
}
