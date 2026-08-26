import { useAtom } from "@effect/atom-react";
import { Organization } from "@stu/core/organization";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  accountReactivity,
  completeReservationMutation,
  reservationReactivity,
} from "#/features/auth/access.ts";
import {
  AuthError,
  AuthHeading,
  AuthNote,
  authNoteLinkClass,
  AuthShell,
} from "#/features/auth/auth-shell.tsx";
import { accessMessage, type AccessFailure } from "#/features/auth/messages.ts";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";

const Search = Schema.Struct({ reservation: Organization.SchoolAccessReservationToken });

export const Route = createFileRoute("/_client/aktivieren_/abschliessen")({
  validateSearch: Schema.decodeUnknownSync(Search),
  component: CompleteActivationPage,
  head: () => ({ meta: [{ title: "Zugang wird aktiviert | Studienbuch" }] }),
});

/**
 * Failures a second attempt could survive.
 *
 * A reservation that is gone will still be gone, so that screen offers a new code instead. An
 * unverified address is here because verifying it happens in another tab: coming back and pressing
 * the button is exactly the right thing to do.
 */
const retryableTags: ReadonlySet<AccessFailure["_tag"]> = new Set([
  "RpcClientError",
  "AccessApi.RateLimited",
  "SchoolAccess.EmailNotVerified",
]);

/** What went wrong, and what the person can do about it. */
interface Failure {
  readonly message: string;
  /** False where trying again cannot help, so the screen offers a different way on instead. */
  readonly retryable: boolean;
}

function CompleteActivationPage() {
  const { reservation } = Route.useSearch();
  const navigate = useNavigate();
  const session = authClient.useSession();
  const [completionResult, completeReservation] = useAtom(completeReservationMutation, {
    mode: "promiseExit",
  });
  const attempted = useRef(false);
  const [failure, setFailure] = useState<Failure>();

  const redeem = useCallback(async () => {
    setFailure(undefined);
    const result = await completeReservation({
      payload: { token: reservation },
      reactivityKeys: {
        ...accountReactivity,
        ...reservationReactivity(reservation),
      },
    });
    if (Exit.isSuccess(result)) {
      await navigate({ to: "/einrichten", search: { access: result.value.id }, replace: true });
      return;
    }
    const error = result.cause.pipe(Cause.findErrorOption, Option.getOrUndefined);
    // An access the account already holds is a success from the person's point of view: they are
    // enrolled, which is what they came here for, so send them on rather than showing an error.
    if (error?._tag === "SchoolAccess.AccessAlreadyExists") {
      await navigate({ to: "/app", replace: true });
      return;
    }
    setFailure({
      message: accessMessage(error),
      retryable: error === undefined || retryableTags.has(error._tag),
    });
  }, [completeReservation, navigate, reservation]);

  useEffect(() => {
    if (session.isPending || session.data === null || attempted.current) return;
    attempted.current = true;
    void redeem();
  }, [redeem, session.data, session.isPending]);

  if (!session.isPending && session.data === null) {
    return (
      <AuthShell>
        <AuthHeading>Fast geschafft</AuthHeading>
        <p className="enter-later mt-4 text-center text-ink-soft">
          Melde dich an, um den Schulzugang zu übernehmen.
        </p>
        <Button asChild className="mt-7 w-full" radius="pill" size="xl" variant="brand">
          <Link search={{ reservation }} to="/anmelden">
            Anmelden
          </Link>
        </Button>
      </AuthShell>
    );
  }

  if (failure !== undefined) {
    return (
      <AuthShell>
        <AuthHeading>Das hat nicht geklappt</AuthHeading>
        <div className="mt-6">
          <AuthError>{failure.message}</AuthError>
        </div>
        {failure.retryable ? (
          <Button
            aria-busy={completionResult.waiting}
            className="mt-7 w-full"
            disabled={completionResult.waiting}
            onClick={() => void redeem()}
            radius="pill"
            size="xl"
            type="button"
            variant="brand"
          >
            {completionResult.waiting ? "Wird erneut versucht ..." : "Erneut versuchen"}
          </Button>
        ) : (
          <Button asChild className="mt-7 w-full" radius="pill" size="xl" variant="brand">
            <Link to="/aktivieren">Zugangscode eingeben</Link>
          </Button>
        )}
        <AuthNote>
          Oder weiter zu{" "}
          <Link className={authNoteLinkClass} to="/app">
            deinem Konto
          </Link>
          .
        </AuthNote>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthHeading>Gleich geschafft</AuthHeading>
      <p aria-live="polite" className="enter-later mt-4 text-center text-ink-soft">
        <span className="working">Wir schalten deinen Schulzugang frei ...</span>
      </p>
    </AuthShell>
  );
}
