import { Organization } from "@stu/core/organization";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useEffect, useState } from "react";
import { inspectReservation, type ReservationView } from "#/features/auth/access.ts";
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
import { accessMessage, betterAuthMessage } from "#/features/auth/messages.ts";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({ reservation: Schema.String });

export const Route = createFileRoute("/registrieren")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: RegisterPage,
  head: () => ({ meta: [{ title: "Konto erstellen | Studienbuch" }] }),
});

/** What the page knows about the reservation it was sent here with. */
type Reservation =
  | { readonly state: "pending" }
  | { readonly state: "ready"; readonly view: ReservationView }
  | { readonly state: "unavailable"; readonly message: string };

function RegisterPage() {
  const { reservation } = Route.useSearch();
  const [claim, setClaim] = useState<Reservation>({ state: "pending" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    void inspectReservation(reservation).then((result) => {
      if (!current) return;
      setClaim(
        result.ok
          ? { state: "ready", view: result.value }
          : { state: "unavailable", message: accessMessage(result.error) },
      );
    });
    return () => {
      current = false;
    };
  }, [reservation]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const callbackPath = `/aktivieren/abschliessen?reservation=${encodeURIComponent(reservation)}`;
    // Sent because the endpoint requires it, and overwritten by the server with this same value:
    // a person's real name belongs to the school profile they author, never to the global account.
    const result = await authClient.signUp.email(
      {
        name: Organization.neutralAccountName,
        email,
        password,
        callbackURL: `${window.location.origin}${callbackPath}`,
      },
      { headers: { "x-studienbuch-registration": reservation } },
    );
    setBusy(false);
    if (result.error !== null) {
      setError(
        betterAuthMessage(
          result.error,
          "Das Konto konnte nicht erstellt werden. Versuche es gleich noch einmal.",
        ),
      );
      return;
    }
    setSentTo(email);
  };

  if (sentTo !== undefined) {
    return (
      <AuthShell>
        <AuthDone title="Schau in dein Postfach">
          Wir haben einen Bestätigungslink an <span className="text-ink">{sentTo}</span> geschickt.
          Danach schließen wir die Aktivierung ab.
        </AuthDone>
        {/* The address is worth being able to correct: a link sent to a mistyped address never
            arrives, and nothing else on this screen would ever tell the user why. */}
        <Button
          className="mt-7 w-full"
          onClick={() => {
            setSentTo(undefined);
          }}
          radius="pill"
          size="lg"
          type="button"
          variant="outline"
        >
          Andere E-Mail-Adresse verwenden
        </Button>
      </AuthShell>
    );
  }

  if (claim.state === "unavailable") {
    return (
      <AuthShell>
        <AuthHeading>Nicht mehr vorgemerkt</AuthHeading>
        <p className="enter-later mt-4 text-center text-ink-soft">{claim.message}</p>
        <Button asChild className="mt-7 w-full" radius="pill" size="xl" variant="brand">
          <Link to="/aktivieren">Zugangscode eingeben</Link>
        </Button>
        <AuthNote>
          Schon ein Konto?{" "}
          <Link className={authNoteLinkClass} search={{}} to="/anmelden">
            Anmelden
          </Link>
        </AuthNote>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading>Konto erstellen</AuthHeading>
      <p aria-live="polite" className="enter-later mt-4 text-center text-ink-soft">
        {claim.state === "pending"
          ? "Wir prüfen deinen Zugangscode ..."
          : `${claim.view.school.name}, ${claim.view.kind === "Student" ? "Schülerzugang" : "Lehrerzugang"}`}
      </p>
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
        <Field hint="Mindestens acht Zeichen." label="Passwort">
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
        <Button
          radius="pill"
          size="xl"
          type="submit"
          variant="brand"
          {...submitState({ busy, error })}
          disabled={busy || claim.state === "pending"}
        >
          {busy ? <Working>Konto wird erstellt ...</Working> : "Konto erstellen"}
        </Button>
      </form>
      <AuthNote>
        Schon ein Konto?{" "}
        <Link className={authNoteLinkClass} search={{ reservation }} to="/anmelden">
          Anmelden
        </Link>
      </AuthNote>
    </AuthShell>
  );
}
