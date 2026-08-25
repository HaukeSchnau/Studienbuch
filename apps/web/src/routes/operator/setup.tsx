import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import { AuthError, AuthShell } from "#/features/auth/auth-shell.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";

const Search = Schema.Struct({ token: Schema.String });

export const Route = createFileRoute("/operator/setup")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: OperatorSetupPage,
});

function OperatorSetupPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const setup = async () => {
    setBusy(true);
    setError(undefined);
    const registration = await authClient.passkey.addPasskey({ name: "Operator", context: token });
    if (registration.error !== null) {
      setError(
        "Der Passkey konnte nicht eingerichtet werden. Der Link ist möglicherweise abgelaufen.",
      );
      setBusy(false);
      return;
    }
    const signIn = await authClient.signIn.passkey();
    if (signIn.error !== null) {
      setError(
        "Der Passkey wurde gespeichert, aber die Anmeldung ist fehlgeschlagen. Öffne die Anmeldeseite.",
      );
      setBusy(false);
      return;
    }
    await navigate({ to: "/app", replace: true });
  };

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Operator einrichten</h1>
      <p className="mt-4 text-center text-ink-soft">
        Erstelle jetzt den Passkey für dieses Operator-Konto.
      </p>
      {error === undefined ? null : (
        <div className="mt-6">
          <AuthError>{error}</AuthError>
        </div>
      )}
      <Button
        className="mt-7 w-full"
        disabled={busy}
        onClick={() => void setup()}
        radius="pill"
        size="xl"
        variant="brand"
      >
        {busy ? "Passkey wird erstellt ..." : "Passkey erstellen"}
      </Button>
    </AuthShell>
  );
}
