import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import {
  AuthError,
  AuthNote,
  authNoteLinkClass,
  AuthShell,
  Field,
  invalidWhen,
} from "#/features/auth/auth-shell.tsx";
import { betterAuthMessage } from "#/features/auth/messages.ts";
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

  /** Where a successful sign-in lands: back into an activation in progress, or the account. */
  const arrive = () =>
    reservation === undefined
      ? navigate({ to: "/app", replace: true })
      : navigate({ to: "/aktivieren/abschliessen", search: { reservation }, replace: true });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    // The callback matters for the unverified case: Better Auth resends the verification mail, and
    // its link has to come back to the activation rather than to the front page.
    const destination =
      reservation === undefined
        ? "/app"
        : `/aktivieren/abschliessen?reservation=${encodeURIComponent(reservation)}`;
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
    await arrive();
  };

  const signInWithPasskey = async () => {
    setError(undefined);
    const result = await authClient.signIn.passkey();
    if (result.error !== null) {
      setError(betterAuthMessage(result.error, "Der Passkey konnte nicht verwendet werden."));
      return;
    }
    await arrive();
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
            {...invalidWhen(error)}
          />
        </Field>
        <Field label="Passwort">
          <Input
            autoComplete="current-password webauthn"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
            {...invalidWhen(error)}
          />
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button
          aria-busy={busy}
          disabled={busy}
          radius="pill"
          size="xl"
          type="submit"
          variant="brand"
        >
          {busy ? "Anmeldung läuft ..." : "Anmelden"}
        </Button>
      </form>
      <Link
        className="mt-4 block text-center text-sm font-semibold text-accent hover:underline"
        to="/passwort-vergessen"
      >
        Passwort vergessen?
      </Link>
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
      {/* The way in for someone holding a printed code. Without it the school's own instructions
          are the only route to activation, and the header offers sign-in alone. */}
      <AuthNote>
        Zugangscode von deiner Schule?{" "}
        <Link className={authNoteLinkClass} to="/aktivieren">
          Zugang aktivieren
        </Link>
      </AuthNote>
    </AuthShell>
  );
}
