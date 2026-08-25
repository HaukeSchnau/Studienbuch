import { Organization } from "@stu/core/organization";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { reserveAccess } from "#/features/auth/access.ts";
import {
  AuthError,
  AuthNote,
  authNoteLinkClass,
  AuthShell,
  Field,
  invalidWhen,
} from "#/features/auth/auth-shell.tsx";
import { accessMessage } from "#/features/auth/messages.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

export const Route = createFileRoute("/aktivieren")({
  component: ActivatePage,
  head: () => ({ meta: [{ title: "Zugang aktivieren | Studienbuch" }] }),
});

/** Sixteen characters in groups of four, plus the three hyphens between them. */
const formattedCodeLength = Organization.accessCodeLength + 3;

function ActivatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // Held in the printed form, so the field always shows what is on the paper. `repairAccessCode`
  // has already resolved the characters the alphabet leaves ambiguous and dropped anything it
  // cannot place, which is why a complete value here is a valid one.
  const complete = Organization.normalizeAccessCode(code).length === Organization.accessCodeLength;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    const reservation = await reserveAccess(code);
    setBusy(false);
    if (!reservation.ok) {
      setError(accessMessage(reservation.error));
      return;
    }
    await navigate({ to: "/registrieren", search: { reservation: reservation.value.token } });
  };

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Willkommen!</h1>
      <p className="mt-3 text-center text-ink-soft">
        Gib den Zugangscode ein, den du von deiner Schule bekommen hast.
      </p>
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <Field
          hint="Gross- und Kleinschreibung sind egal, die Bindestriche setzen wir selbst."
          label="Zugangscode"
        >
          <Input
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            className="text-center font-mono tracking-[0.2em]"
            inputMode="text"
            maxLength={formattedCodeLength}
            onChange={(event) =>
              setCode(
                Organization.formatAccessCode(Organization.repairAccessCode(event.target.value)),
              )
            }
            placeholder="XXXX-XXXX-XXXX-XXXX"
            required
            spellCheck={false}
            value={code}
            {...invalidWhen(error)}
          />
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button
          aria-busy={busy}
          disabled={busy || !complete}
          radius="pill"
          size="xl"
          type="submit"
          variant="brand"
        >
          {busy ? "Wird geprüft ..." : "Weiter"}
        </Button>
      </form>
      <AuthNote>
        Schon eingerichtet?{" "}
        <Link className={authNoteLinkClass} search={{}} to="/anmelden">
          Anmelden
        </Link>
      </AuthNote>
    </AuthShell>
  );
}
