import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, Plus, School, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { loadAccount, type AccountView, type SchoolAccessView } from "#/features/auth/access.ts";
import { AuthError } from "#/features/auth/auth-shell.tsx";
import { betterAuthMessage } from "#/features/auth/messages.ts";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";

export const Route = createFileRoute("/app")({
  component: AppPage,
  head: () => ({ meta: [{ title: "Mein Konto | Studienbuch" }] }),
});

const kindLabel = (kind: SchoolAccessView["kind"]) =>
  kind === "Student" ? "Schülerzugang" : "Lehrerzugang";

/**
 * The account page.
 *
 * The account is fetched from the browser rather than in a loader: these routes authenticate with
 * the session cookie the browser holds, and a loader would run on the server during SSR where a
 * relative request carries none. So the page states what it is doing while it waits, instead of
 * painting an empty version of itself and rearranging once the answer arrives.
 */
function AppPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountView>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let current = true;
    void loadAccount().then((result) => {
      if (!current) return;
      if (result.ok) setAccount(result.value);
      else void navigate({ to: "/anmelden", search: {}, replace: true });
    });
    return () => {
      current = false;
    };
  }, [navigate]);

  const signOut = async () => {
    await authClient.signOut();
    await navigate({ to: "/anmelden", search: {}, replace: true });
  };

  return (
    <main className="min-h-screen bg-primary-des px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-full bg-white px-5 py-3 shadow-card">
          <Wordmark />
          <Button onClick={() => void signOut()} radius="pill" variant="ghost">
            <LogOut /> Abmelden
          </Button>
        </header>

        <section aria-live="polite" className="mt-10">
          <p className="text-sm font-semibold text-primary-text">Mein Konto</p>
          <h1 className="mt-1 text-4xl text-ink">
            {account === undefined ? "Wird geladen ..." : "Willkommen zurück!"}
          </h1>
          {account?.user.email === null || account === undefined ? null : (
            <p className="mt-2 text-ink-soft">{account.user.email}</p>
          )}
          {account?.operator === true ? (
            <p className="mt-3 inline-flex rounded-full bg-alert-des px-4 py-2 text-sm font-semibold text-ink">
              Plattform-Operator
            </p>
          ) : null}
        </section>

        {error === undefined ? null : (
          <div className="mt-6">
            <AuthError>{error}</AuthError>
          </div>
        )}

        {account === undefined ? null : (
          <>
            <section className="mt-8 grid gap-5 sm:grid-cols-2">
              {account.accesses.map((access) => (
                <article className="rounded-card bg-white p-6 shadow-card" key={access.id}>
                  <div className="flex items-center gap-3 text-primary-text">
                    <School />
                    <h2 className="text-xl">{access.schoolName}</h2>
                  </div>
                  <p className="mt-3 text-sm text-ink-soft">{kindLabel(access.kind)}</p>
                  {access.displayName === null ? (
                    <Button asChild className="mt-5" radius="pill" variant="brand">
                      <Link search={{ access: access.id }} to="/einrichten">
                        Profil einrichten
                      </Link>
                    </Button>
                  ) : (
                    <div className="mt-5">
                      <p className="font-semibold">{access.displayName}</p>
                      <p className="mt-1 text-sm text-ink-soft">
                        {[access.cohort, access.className].filter(Boolean).join(" · ") ||
                          "Noch keine Klasse gewählt"}
                      </p>
                    </div>
                  )}
                </article>
              ))}

              <article className="rounded-card border-2 border-dashed border-primary-pale bg-white/50 p-6">
                <h2 className="text-xl">Weiterer Schulzugang</h2>
                <p className="mt-2 text-sm text-ink-soft">
                  Ein Konto kann Zugangscodes mehrerer Schulen einlösen.
                </p>
                <Button asChild className="mt-5" radius="pill" variant="outline">
                  <Link to="/aktivieren">
                    <Plus /> Zugangscode eingeben
                  </Link>
                </Button>
              </article>
            </section>

            <PasskeySection onError={setError} />
          </>
        )}
      </div>
    </main>
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
    <section className="mt-8 rounded-card bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl">Passkeys</h2>
          <p className="mt-1 text-sm text-ink-soft">Melde dich künftig ohne Passwort an.</p>
        </div>
        <Button
          aria-busy={pending === "add"}
          disabled={pending !== undefined}
          onClick={() => void add()}
          radius="pill"
          variant="outline"
        >
          <KeyRound /> {pending === "add" ? "Wird erstellt ..." : "Passkey hinzufügen"}
        </Button>
      </div>

      <ul aria-live="polite" className="mt-5 grid gap-2">
        {passkeys.isPending ? (
          <li className="text-sm text-ink-soft">Wird geladen ...</li>
        ) : items.length === 0 ? (
          <li className="text-sm text-ink-soft">Noch kein Passkey auf diesem Konto.</li>
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
