import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as Schema from "effect/Schema";
import { useEffect, useRef, useState } from "react";
import { completeReservation } from "#/features/auth/access.ts";
import { AuthError, AuthShell } from "#/features/auth/auth-shell.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";

const Search = Schema.Struct({ reservation: Schema.String });

export const Route = createFileRoute("/aktivieren_/abschliessen")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: CompleteActivationPage,
});

function CompleteActivationPage() {
  const { reservation } = Route.useSearch();
  const navigate = useNavigate();
  const session = authClient.useSession();
  const started = useRef(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (session.isPending || session.data === null || started.current) return;
    started.current = true;
    void completeReservation(reservation)
      .then((result) => {
        if (result.ok) {
          return navigate({ to: "/einrichten", search: { access: result.value.id } });
        }
        setError("Die Reservierung ist abgelaufen oder wurde bereits verwendet.");
        return undefined;
      })
      .catch(() => setError("Die Reservierung ist abgelaufen oder wurde bereits verwendet."));
  }, [navigate, reservation, session.data, session.isPending]);

  if (!session.isPending && session.data === null) {
    return (
      <AuthShell>
        <h1 className="text-center text-3xl text-primary-text">Fast geschafft</h1>
        <p className="mt-4 text-center text-ink-soft">
          Melde dich an, um den Schulzugang zu übernehmen.
        </p>
        <Button
          className="mt-7 w-full"
          onClick={() => void navigate({ to: "/anmelden", search: { reservation } })}
          radius="pill"
          size="xl"
          variant="brand"
        >
          Anmelden
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-center text-3xl text-primary-text">Zugang wird aktiviert</h1>
      <p className="mt-4 text-center text-ink-soft">Einen kleinen Moment noch.</p>
      {error === undefined ? null : (
        <div className="mt-6">
          <AuthError>{error}</AuthError>
        </div>
      )}
    </AuthShell>
  );
}
