import { useAtom } from "@effect/atom-react";
import { Organization } from "@stu/core/organization";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import { useState } from "react";
import { reserveAccessMutation } from "#/features/auth/access.ts";
import {
  AuthError,
  AuthHeading,
  AuthNote,
  authNoteLinkClass,
  AuthShell,
  AuthTick,
  Field,
  invalidWhen,
  submitState,
  Working,
} from "#/features/auth/auth-shell.tsx";
import { accessMessage } from "#/features/auth/messages.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";

export const Route = createFileRoute("/_client/aktivieren")({
  component: ActivatePage,
  head: () => ({ meta: [{ title: "Zugang aktivieren | Studienbuch" }] }),
});

/** Sixteen characters in groups of four, plus the three hyphens between them. */
const formattedCodeLength = Organization.accessCodeLength + 3;

function ActivatePage() {
  const navigate = useNavigate();
  const [reservationResult, reserveAccess] = useAtom(reserveAccessMutation, {
    mode: "promiseExit",
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const busy = reservationResult.waiting;

  // Held in the printed form, so the field always shows what is on the paper. `repairAccessCode`
  // has already resolved the characters the alphabet leaves ambiguous and dropped anything it
  // cannot place, which is why a complete value here is a valid one.
  const complete = Organization.normalizeAccessCode(code).length === Organization.accessCodeLength;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    const reservation = await reserveAccess({ payload: { code } });
    if (Exit.isFailure(reservation)) {
      setError(accessMessage(reservation.cause.pipe(Cause.findErrorOption, Option.getOrUndefined)));
      return;
    }
    await navigate({ to: "/registrieren", search: { reservation: reservation.value.token } });
  };

  return (
    <AuthShell>
      <AuthHeading>Willkommen!</AuthHeading>
      <p className="enter-later mt-4 text-center text-ink-soft">
        Gib den Zugangscode ein, den du von deiner Schule bekommen hast.
      </p>
      <form className="mt-7 grid gap-5" onSubmit={submit}>
        <Field
          hint="Gross- und Kleinschreibung sind egal, die Bindestriche setzen wir selbst."
          label="Zugangscode"
        >
          {/*
            The one moment in the whole enrollment worth marking. Sixteen characters copied off
            paper is the most error-prone thing Studienbuch ever asks anyone to do, and the tick is
            how the field says "that is a whole code" without waiting for the server to say it.
          */}
          <span className="relative block">
            <Input
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              className="pr-12 text-center font-mono tracking-[0.2em]"
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
            {complete ? (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <AuthTick className="size-6" />
              </span>
            ) : null}
          </span>
        </Field>
        {error === undefined ? null : <AuthError>{error}</AuthError>}
        <Button
          size="xl"
          type="submit"
          variant="brand"
          {...submitState({ busy, error })}
          disabled={busy || !complete}
        >
          {busy ? <Working>Wird geprüft ...</Working> : "Weiter"}
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
