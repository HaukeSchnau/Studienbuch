import { useAtomSuspense } from "@effect/atom-react";
import { Organization } from "@stu/core/organization";
import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { useState } from "react";
import { reservationAtom } from "#/features/auth/access.ts";
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
import { accessMessage, betterAuthMessage, isAccessFailure } from "#/features/auth/messages.ts";
import { ErrorState } from "#/features/errors/error-states.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { getAtomResult } from "#/infra/effect-atom/loader.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

const Search = Schema.Struct({ reservation: Organization.SchoolAccessReservationToken });
const validateSearch = Schema.decodeUnknownSync(Search);

export const Route = createFileRoute("/_client/registrieren")({
  validateSearch,
  loaderDeps: ({ search }) => ({ reservation: search.reservation }),
  loader: async ({ context, deps, abortController }) => {
    await getAtomResult(
      context.atomRegistry,
      reservationAtom(deps.reservation),
      abortController.signal,
    );
  },
  component: RegisterPage,
  errorComponent: RegistrationError,
  head: () => ({ meta: [{ title: "Konto erstellen | Studienbuch" }] }),
});

function RegistrationError({ error, reset }: ErrorComponentProps) {
  if (!isAccessFailure(error) || error._tag === "RpcClientError") {
    return <ErrorState reset={reset} />;
  }

  return (
    <AuthShell>
      <AuthHeading>
        {error._tag === "SchoolAccess.ReservationUnavailable"
          ? "Nicht mehr vorgemerkt"
          : "Das hat nicht geklappt"}
      </AuthHeading>
      <p className="enter-later mt-4 text-center text-ink-soft">{accessMessage(error)}</p>
      <Button asChild className="mt-7 w-full" size="xl" variant="brand">
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

function RegisterPage() {
  const { reservation } = Route.useSearch();
  const claim = useAtomSuspense(reservationAtom(reservation)).value;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const accountName = Schema.decodeExit(Organization.AccountName)(name);
    if (Exit.isFailure(accountName)) {
      setBusy(false);
      setError("Gib den Namen ein, unter dem du Studienbuch verwendest.");
      return;
    }
    const callbackPath = `/aktivieren/abschliessen?reservation=${encodeURIComponent(reservation)}`;
    const result = await authClient.signUp.email(
      {
        name: accountName.value,
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
        <Button
          className="mt-7 w-full"
          onClick={() => {
            setSentTo(undefined);
          }}
          size="lg"
          type="button"
          variant="outline"
        >
          Andere E-Mail-Adresse verwenden
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading>Konto erstellen</AuthHeading>
      <p className="enter-later mt-4 text-center text-ink-soft">
        {claim.school.name}, {claim.kind === "Student" ? "Schülerzugang" : "Lehrerzugang"}
      </p>
      <form className="mt-7 grid gap-4" onSubmit={submit}>
        <Field label="Name">
          <Input
            autoComplete="name"
            maxLength={Organization.accountNameMaxLength}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
            {...invalidWhen(error)}
          />
        </Field>
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
        <Button size="xl" type="submit" variant="brand" {...submitState({ busy, error })}>
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
