import { useAtomValue } from "@effect/atom-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as DateTime from "effect/DateTime";
import { AsyncResult } from "effect/unstable/reactivity";
import { KeyRound, LogOut, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { accountAtom, type AccountView, type SchoolAccessView } from "#/features/auth/access.ts";
import { AuthError } from "#/features/auth/auth-shell.tsx";
import { betterAuthMessage } from "#/features/auth/messages.ts";
import { EdgeBlob } from "#/domain-ui/brand/blobs.tsx";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { initials, shortName } from "#/domain-ui/person-name.ts";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { PointerSpot } from "#/ui/pointer-spot.tsx";

export const Route = createFileRoute("/app")({
  component: AppPage,
  head: () => ({ meta: [{ title: "Mein Konto | Studienbuch" }] }),
});

const kindLabel = (kind: SchoolAccessView["kind"]) =>
  kind === "Student" ? "Schülerzugang" : "Lehrerzugang";

/**
 * The name to greet someone by, out of one per school.
 *
 * The newest, because that is the enrollment they most recently thought about — and because it is
 * a rule rather than "whichever row came back first", which is what this used to be. An account
 * whose profiles are all still unnamed is greeted without one, which is friendlier than inventing
 * a name for someone who has not chosen theirs yet.
 */
const greetingName = (accesses: ReadonlyArray<SchoolAccessView>) =>
  accesses
    .filter((access) => access.displayName !== null)
    .sort(
      (left, right) =>
        DateTime.toEpochMillis(right.createdAt) - DateTime.toEpochMillis(left.createdAt),
    )
    .at(0)?.displayName ?? undefined;

/** What is left to do, said as a sentence rather than left for the person to work out. */
const nextStep = (account: AccountView) => {
  if (account.accesses.length === 0) {
    return "Löse den Zugangscode deiner Schule ein, dann geht es los.";
  }
  return account.accesses.some((access) => access.displayName === null)
    ? "Ein Schulzugang wartet noch auf deinen Namen."
    : "Alles eingerichtet. Der Rest deines Studienbuchs wartet in der App.";
};

/**
 * The account page.
 *
 * It opens the way the app opens: the brand's green, the wordmark, and "Moin, {name}!" — because
 * this is the same product as the phone in their pocket, and a person who signs in on the web
 * should not arrive at something that reads like a settings screen for it.
 *
 * The account is fetched through an AtomRpc query rather than in a loader: these routes authenticate with
 * the session cookie the browser holds, and a loader would run on the server during SSR where a
 * relative request carries none. So the panel is painted at once and only the name arrives late,
 * which is why the greeting has a form that works without one.
 */
function AppPage() {
  const navigate = useNavigate();
  const accountResult = useAtomValue(accountAtom);
  const account: AccountView | undefined = AsyncResult.isSuccess(accountResult)
    ? accountResult.value
    : undefined;
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (AsyncResult.isFailure(accountResult)) {
      void navigate({ to: "/anmelden", search: {}, replace: true });
    }
  }, [accountResult, navigate]);

  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/anmelden", search: {}, replace: true });
  };

  const name = account === undefined ? undefined : greetingName(account.accesses);

  return (
    <main className="relative isolate min-h-screen overflow-x-clip bg-primary-des px-5 py-6 sm:px-8">
      <EdgeBlob
        blob="kidney"
        className="-left-40 top-[38%] hidden size-[26rem] lg:block"
        duration={29}
        offset={0.15}
        rotate={18}
        tone="green"
      />
      <EdgeBlob
        blob="twin"
        className="-right-44 top-[8%] hidden size-[28rem] lg:block"
        duration={35}
        offset={0.55}
        rotate={-12}
        tone="blue"
      />

      <div className="mx-auto max-w-4xl">
        <PointerSpot className="enter relative overflow-hidden rounded-card-lg bg-primary px-6 py-7 sm:px-9 sm:py-9">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Wordmark tone="on-primary" />
            <Button
              className="text-white hover:bg-white/15"
              onClick={() => void signOut()}
              radius="pill"
              variant="ghost"
            >
              <LogOut /> Abmelden
            </Button>
          </div>

          <div aria-live="polite" className="mt-7">
            <h1 className="text-4xl text-white sm:text-5xl">
              {name === undefined ? "Moin!" : `Moin, ${shortName(name)}!`}
            </h1>
            <p className="mt-2 max-w-lg text-lg/relaxed text-white/90">
              {account === undefined ? (
                <span className="working">Wir holen deine Schulzugänge ...</span>
              ) : (
                nextStep(account)
              )}
            </p>
          </div>

          {account?.operator === true ? (
            <p className="mt-5 inline-flex rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white">
              Plattform-Operator
            </p>
          ) : null}
        </PointerSpot>

        {error === undefined ? null : (
          <div className="mt-6">
            <AuthError>{error}</AuthError>
          </div>
        )}

        {account === undefined ? null : (
          <>
            <section className="enter-late mt-6 grid gap-5 sm:grid-cols-2">
              {account.accesses.map((access) => (
                <SchoolCard access={access} key={access.id} />
              ))}

              <article className="rounded-card border-2 border-dashed border-primary-pale bg-white/50 p-6">
                <h2 className="text-xl">Noch eine Schule?</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Ein Konto kann die Zugangscodes mehrerer Schulen einlösen.
                </p>
                <Button asChild className="mt-5" radius="pill" variant="outline">
                  <Link to="/aktivieren">
                    <Plus /> Zugangscode eingeben
                  </Link>
                </Button>
              </article>
            </section>

            <PasskeySection onError={setError} />

            <p className="mt-8 text-center text-sm text-ink-soft">
              Angemeldet als {account.user.email ?? "Operator-Konto"}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * One school's enrollment.
 *
 * The initials are the point: two letters in the brand's green make a row of cards read as people's
 * notebooks rather than as database rows, and they are the only thing distinguishing two cards for
 * someone enrolled at two schools. A profile with no name yet says so instead of showing a gap.
 */
function SchoolCard({ access }: { readonly access: SchoolAccessView }) {
  const named = access.displayName !== null;

  return (
    <article className="weight-hover press rounded-card bg-white p-6 shadow-card hover:shadow-card-lg">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-des text-lg font-bold text-primary-text"
        >
          {named ? initials(access.displayName ?? "") : "?"}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-xl text-primary-text">{access.schoolName}</h3>
          <p className="mt-1 inline-flex rounded-full bg-primary-des px-3 py-1 text-xs font-semibold text-primary-text">
            {kindLabel(access.kind)}
          </p>
        </div>
      </div>

      {named ? (
        <div className="mt-5">
          <p className="font-semibold">{access.displayName}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {[access.cohort, access.className].filter(Boolean).join(" · ") ||
              "Noch keine Klasse gewählt"}
          </p>
        </div>
      ) : (
        <Button asChild className="mt-5" radius="pill" variant="brand">
          <Link search={{ access: access.id }} to="/einrichten">
            Profil einrichten
          </Link>
        </Button>
      )}
    </article>
  );
}

/**
 * The passkeys on this account, and the two things that can be done to them.
 *
 * A list rather than a lone button: registering a passkey is a browser ceremony that ends silently,
 * so without somewhere for the new key to appear there is no way to tell a success from a dismissed
 * dialog. The list is also the only place a key can be removed once a device is gone.
 */
function PasskeySection({ onError }: { readonly onError: (message?: string) => void }) {
  const passkeys = authClient.useListPasskeys();
  const [pending, setPending] = useState<string>();

  const add = useCallback(async () => {
    setPending("add");
    onError(undefined);
    const result = await authClient.passkey.addPasskey({ name: defaultPasskeyName() });
    setPending(undefined);
    if (result.error !== null) {
      onError(betterAuthMessage(result.error, "Der Passkey konnte nicht hinzugefügt werden."));
    }
  }, [onError]);

  const remove = useCallback(
    async (id: string) => {
      setPending(id);
      onError(undefined);
      const result = await authClient.passkey.deletePasskey({ id });
      setPending(undefined);
      if (result.error !== null) {
        onError(betterAuthMessage(result.error, "Der Passkey konnte nicht entfernt werden."));
      }
    },
    [onError],
  );

  const items = passkeys.data ?? [];

  return (
    <section className="enter-later mt-6 rounded-card bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl">Passkeys</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Mit Fingerabdruck oder Gesicht anmelden, ganz ohne Passwort.
          </p>
        </div>
        <Button
          aria-busy={pending === "add"}
          disabled={pending !== undefined}
          onClick={() => void add()}
          radius="pill"
          variant="outline"
        >
          <KeyRound />
          {pending === "add" ? (
            <span className="working">Wird erstellt ...</span>
          ) : (
            "Passkey anlegen"
          )}
        </Button>
      </div>

      <ul aria-live="polite" className="mt-5 grid gap-2">
        {passkeys.isPending ? (
          <li className="text-sm text-ink-soft">
            <span className="working">Wird geladen ...</span>
          </li>
        ) : items.length === 0 ? (
          <li className="rounded-2xl bg-primary-des px-4 py-3 text-sm text-ink-soft">
            Noch keiner. Einer reicht, damit du dein Passwort nie wieder tippen musst.
          </li>
        ) : (
          items.map((passkey) => (
            <li
              className="flex items-center justify-between gap-4 rounded-2xl bg-primary-des px-4 py-3"
              key={passkey.id}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{passkey.name ?? "Passkey"}</span>
                <span className="block text-xs text-ink-soft">
                  Seit {new Date(passkey.createdAt).toLocaleDateString("de-DE")}
                </span>
              </span>
              <Button
                aria-busy={pending === passkey.id}
                aria-label={`${passkey.name ?? "Passkey"} entfernen`}
                disabled={pending !== undefined}
                onClick={() => void remove(passkey.id)}
                radius="pill"
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

/**
 * A name that says which device the key is on, since that is the only thing that distinguishes two
 * of them later. The platform is the most specific thing a browser will tell us without asking.
 */
const defaultPasskeyName = () => {
  const platform = navigator.userAgent.match(/\((?<platform>[^;)]+)/)?.groups?.platform?.trim();
  return platform === undefined ? "Passkey" : `Passkey auf ${platform}`;
};
