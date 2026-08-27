import { createFileRoute, Link } from "@tanstack/react-router";
import { KeyRound, LogOut, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import type { SchoolAccessView } from "#/features/auth/access.ts";
import { AuthError } from "#/features/auth/auth-shell.tsx";
import { betterAuthMessage } from "#/features/auth/messages.ts";
import { useSignOut } from "#/features/auth/use-sign-out.ts";
import { initials } from "#/domain-ui/person-name.ts";
import { DestinationPage } from "#/domain-ui/shell/destination-page.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { useShell } from "#/domain-ui/shell/shell-state.tsx";

export const Route = createFileRoute("/_client/app/konto")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "Mein Konto | Studienbuch" }] }),
});

const kindLabel = (kind: SchoolAccessView["kind"]) =>
  kind === "Student" ? "Schülerzugang" : "Lehrerzugang";

/**
 * The account, as opposed to any one context.
 *
 * Everything here outlives a school: the address you sign in with, the passkeys on your devices, and
 * the list of schools you have redeemed a code for. That is why it is reachable from every context
 * rather than living inside one.
 *
 * Signing out is here and in the account menu both, and deliberately so: this is where it belongs
 * next to the things it ends, and the menu is where somebody actually reaches for it.
 */
function AccountPage() {
  const { account } = useShell();
  const signOut = useSignOut();
  const [error, setError] = useState<string>();

  return (
    <DestinationPage
      lead={`Angemeldet als ${account.user.email ?? "Operator-Konto"}`}
      title="Mein Konto"
    >
      {error === undefined ? null : (
        <div className="mb-6">
          <AuthError>{error}</AuthError>
        </div>
      )}

      <h2 className="text-lg">Meine Schulzugänge</h2>
      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        {account.accesses.map((access) => (
          <SchoolCard access={access} key={access.id} />
        ))}

        <article className="rounded-card border-2 border-dashed border-primary-pale bg-white/50 p-5">
          <h3 className="text-lg">Noch eine Schule?</h3>
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

      <Button className="mt-7" onClick={() => void signOut()} radius="pill" variant="outline">
        <LogOut /> Abmelden
      </Button>
    </DestinationPage>
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
  const displayName = access.displayName;

  return (
    <article className="rounded-card bg-white p-5 shadow-card">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-des text-lg font-bold text-primary-text"
        >
          {displayName === null ? "?" : initials(displayName)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg text-primary-text">{access.schoolName}</h3>
          <p className="mt-1 inline-flex rounded-full bg-primary-des px-3 py-1 text-xs font-semibold text-primary-text">
            {kindLabel(access.kind)}
          </p>
        </div>
      </div>

      {displayName === null ? (
        <Button asChild className="mt-5" radius="pill" variant="brand">
          <Link search={{ access: access.id }} to="/einrichten">
            Profil einrichten
          </Link>
        </Button>
      ) : (
        <div className="mt-5">
          <p className="font-semibold">{displayName}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {[access.cohort, access.className].filter(Boolean).join(" · ") ||
              "Noch keine Klasse gewählt"}
          </p>
        </div>
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
    <section className="mt-7 rounded-card bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg">Passkeys</h2>
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
