import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useState } from "react";
import { AuthError, AuthHeading, AuthShell, Working } from "#/features/auth/auth-shell.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";

const Search = Schema.Struct({ token: Schema.String });

export const Route = createFileRoute("/operator/setup")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: OperatorSetupPage,
  head: () => ({ meta: [{ title: "Operator einrichten | Studienbuch" }] }),
});

/**
 * How far the ceremony got.
 *
 * `registered` is its own state rather than a message to read, because the setup token is spent by
 * a successful registration: offering the button again would send the operator back through a link
 * that can no longer work, when the passkey they need already exists.
 */
type Progress = "ready" | "busy" | "registered";

function OperatorSetupPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Progress>("ready");
  const [error, setError] = useState<string>();

  const setup = async () => {
    setProgress("busy");
    setError(undefined);
    const registration = await authClient.passkey.addPasskey({ name: "Operator", context: token });
    if (registration.error !== null) {
      setError(
        "Der Passkey konnte nicht eingerichtet werden. Der Link ist möglicherweise abgelaufen.",
      );
      setProgress("ready");
      return;
    }
    const signIn = await authClient.signIn.passkey();
    if (signIn.error !== null) {
      setError("Der Passkey wurde gespeichert, aber die Anmeldung ist fehlgeschlagen.");
      setProgress("registered");
      return;
    }
    await navigate({ to: "/app", replace: true });
  };

  return (
    <AuthShell>
      <AuthHeading>Operator einrichten</AuthHeading>
      <p className="enter-later mt-4 text-center text-ink-soft">
        {progress === "registered"
          ? "Der Passkey für dieses Operator-Konto ist eingerichtet."
          : "Erstelle jetzt den Passkey für dieses Operator-Konto."}
      </p>
      {error === undefined ? null : (
        <div className="mt-6">
          <AuthError>{error}</AuthError>
        </div>
      )}
      {progress === "registered" ? (
        <Button asChild className="mt-7 w-full" radius="pill" size="xl" variant="brand">
          <Link search={{}} to="/anmelden">
            Mit Passkey anmelden
          </Link>
        </Button>
      ) : (
        <Button
          aria-busy={progress === "busy"}
          className="mt-7 w-full"
          disabled={progress === "busy"}
          onClick={() => void setup()}
          radius="pill"
          size="xl"
          variant="brand"
        >
          {progress === "busy" ? <Working>Passkey wird erstellt ...</Working> : "Passkey erstellen"}
        </Button>
      )}
    </AuthShell>
  );
}
