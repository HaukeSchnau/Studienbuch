import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useEffect, useState } from "react";
import { inspectReservation, type ReservationView } from "#/features/auth/access.ts";
import { AuthError, AuthShell, Field } from "#/features/auth/auth-shell.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({ reservation: Schema.String });

export const Route = createFileRoute("/registrieren")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: RegisterPage,
  head: () => ({ meta: [{ title: "Konto erstellen | Studienbuch" }] }),
});

function RegisterPage() {
  const { reservation } = Route.useSearch();
  const navigate = useNavigate();
  const [view, setView] = useState<ReservationView>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void inspectReservation(reservation)
      .then((result) => {
        if (result.ok) setView(result.value);
        else setError("Diese Reservierung ist abgelaufen.");
      })
      .catch(() => setError("Diese Reservierung ist abgelaufen."));
  }, [reservation]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const callbackPath = `/aktivieren/abschliessen?reservation=${encodeURIComponent(reservation)}`;
    const result = await authClient.signUp.email(
      {
        name: "Studienbuch-Konto",
        email,
        password,
        callbackURL: `${window.location.origin}${callbackPath}`,
      },
      { headers: { "x-studienbuch-registration": reservation } },
    );
    setBusy(false);
    if (result.error !== null) {
      setError(
        "Das Konto konnte nicht erstellt werden. Prüfe deine Angaben und versuche es erneut.",
      );
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <AuthShell>
        <h1 className="text-center text-3xl text-primary-text">Schau in dein Postfach</h1>
        <p className="mt-4 text-center text-ink-soft">
          Wir haben dir einen Bestätigungslink geschickt. Danach schließen wir die Aktivierung ab.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Konto erstellen</h1>
      {view === undefined ? null : (
        <p className="mt-3 text-center text-ink-soft">
          {view.school.name}, {view.kind === "Student" ? "Schülerzugang" : "Lehrerzugang"}
        </p>
      )}
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
        <Field label="Passwort">
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
        <Button
          disabled={busy || view === undefined}
          radius="pill"
          size="xl"
          type="submit"
          variant="brand"
        >
          {busy ? "Konto wird erstellt ..." : "Konto erstellen"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Schon ein Konto?{" "}
        <button
          className="font-semibold text-accent hover:underline"
          onClick={() => void navigate({ to: "/anmelden", search: { reservation } })}
          type="button"
        >
          Anmelden
        </button>
      </p>
    </AuthShell>
  );
}
