import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { reserveAccess } from "#/features/auth/access.ts";
import { AuthError, AuthShell, Field } from "#/features/auth/auth-shell.tsx";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

export const Route = createFileRoute("/aktivieren")({
  component: ActivatePage,
  head: () => ({ meta: [{ title: "Zugang aktivieren | Studienbuch" }] }),
});

function ActivatePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const reservation = await reserveAccess(code);
      if (!reservation.ok) {
        setError("Der Zugangscode ist ungültig, bereits vergeben oder gerade reserviert.");
        setBusy(false);
        return;
      }
      await navigate({ to: "/registrieren", search: { reservation: reservation.value.token } });
    } catch {
      setError("Der Zugangscode ist ungültig, bereits vergeben oder gerade reserviert.");
    }
    setBusy(false);
  };

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Willkommen!</h1>
      <p className="mt-3 text-center text-ink-soft">
        Gib den Zugangscode ein, den du von deiner Schule bekommen hast.
      </p>
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <Field label="Zugangscode">
          <Input
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            inputMode="text"
            maxLength={19}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            required
            spellCheck={false}
            value={code}
          />
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button disabled={busy} radius="pill" size="xl" type="submit" variant="brand">
          {busy ? "Wird geprüft ..." : "Weiter"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-soft">
        Schon eingerichtet?{" "}
        <a className="font-semibold text-accent hover:underline" href="/anmelden">
          Anmelden
        </a>
      </p>
    </AuthShell>
  );
}
