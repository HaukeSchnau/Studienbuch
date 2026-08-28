import { Organization } from "@stu/core/organization";
import { createFileRoute, Link } from "@tanstack/react-router";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { KeyRound, LogOut, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import type { SchoolAccessView } from "#/features/auth/access.ts";
import { AuthError, Field, submitState, Working } from "#/features/auth/auth-shell.tsx";
import { betterAuthMessage } from "#/features/auth/messages.ts";
import { useRefreshAuthorization } from "#/features/auth/use-refresh-authorization.ts";
import { useSignOut } from "#/features/auth/use-sign-out.ts";
import { initials } from "#/domain-ui/person-name.ts";
import { DestinationPage } from "#/domain-ui/shell/destination-page.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";
import { Input } from "#/ui/input.tsx";
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
    <DestinationPage lead={`Angemeldet als ${account.user.email}`} title="Mein Konto">
      {error === undefined ? null : (
        <div className="mb-6">
          <AuthError>{error}</AuthError>
        </div>
      )}

      <IdentitySection onError={setError} />

      <h2 className="mt-7 text-lg">Meine Schulzugänge</h2>
      <section className="mt-4 grid gap-4 sm:grid-cols-2">
        {account.accesses.map((access) => (
          <SchoolCard access={access} accountName={account.user.name} key={access.id} />
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

/** Account-owned identity, independent of every school access and operator grant. */
function IdentitySection({ onError }: { readonly onError: (message?: string) => void }) {
  const { account } = useShell();
  const refreshAuthorization = useRefreshAuthorization();
  const [name, setName] = useState<string>(account.user.name);
  const [email, setEmail] = useState(account.user.email);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    onError(undefined);
    setNotice(undefined);
    const accountName = Schema.decodeExit(Organization.AccountName)(name);
    if (Exit.isFailure(accountName)) {
      onError("Gib den Namen ein, unter dem du Studienbuch verwendest.");
      return;
    }

    setBusy(true);
    const nameChanged = accountName.value !== account.user.name;
    const emailChanged = email.trim().toLowerCase() !== account.user.email;

    if (nameChanged) {
      const result = await authClient.updateUser({ name: accountName.value });
      if (result.error !== null) {
        setBusy(false);
        onError(betterAuthMessage(result.error, "Der Name konnte nicht gespeichert werden."));
        return;
      }
    }

    if (emailChanged) {
      const result = await authClient.changeEmail({
        newEmail: email.trim(),
        callbackURL: `${window.location.origin}/app/konto`,
      });
      if (result.error !== null) {
        setBusy(false);
        if (nameChanged) await refreshAuthorization();
        onError(
          betterAuthMessage(result.error, "Die E-Mail-Adresse konnte nicht geändert werden."),
        );
        return;
      }
    }

    if (nameChanged) await refreshAuthorization();
    setBusy(false);
    setNotice(
      emailChanged
        ? "Bestätige die neue E-Mail-Adresse über den Link, den wir dir geschickt haben."
        : nameChanged
          ? "Dein Name wurde gespeichert."
          : "Es gibt nichts zu ändern.",
    );
  };

  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h2 className="text-lg">Kontodaten</h2>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={save}>
        <Field label="Name">
          <Input
            autoComplete="name"
            maxLength={Organization.accountNameMaxLength}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field label="E-Mail-Adresse">
          <Input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </Field>
        <div className="flex items-center gap-4 sm:col-span-2">
          <Button type="submit" variant="brand" {...submitState({ busy, error: undefined })}>
            {busy ? <Working>Wird gespeichert ...</Working> : "Änderungen speichern"}
          </Button>
          {notice === undefined ? null : (
            <p aria-live="polite" className="text-sm text-ink-soft">
              {notice}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}

/**
 * One school's enrollment.
 *
 * The account name owns the person's identity. This card adds only the information that belongs to
 * one school access.
 */
function SchoolCard({
  access,
  accountName,
}: {
  readonly access: SchoolAccessView;
  readonly accountName: string;
}) {
  return (
    <article className="rounded-card bg-white p-5 shadow-card">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-des text-lg font-bold text-primary-text"
        >
          {initials(accountName)}
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg text-primary-text">{access.schoolName}</h3>
          <p className="mt-1 inline-flex rounded-full bg-primary-des px-3 py-1 text-xs font-semibold text-primary-text">
            {kindLabel(access.kind)}
          </p>
        </div>
      </div>

      {access.profile === null ? (
        <Button asChild className="mt-5" radius="pill" variant="brand">
          <Link search={{ access: access.id }} to="/einrichten">
            Profil einrichten
          </Link>
        </Button>
      ) : (
        <div className="mt-5">
          <p className="font-semibold">{accountName}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {[access.profile.cohort, access.profile.className].filter(Boolean).join(" · ") ||
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
