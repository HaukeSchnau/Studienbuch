import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { KeyRound, LogOut, Plus, School } from "lucide-react";
import { useEffect, useState } from "react";
import { loadAccount, type AccountView } from "#/features/auth/access.ts";
import { AuthError } from "#/features/auth/auth-shell.tsx";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { authClient } from "#/infra/auth/client.ts";
import { Button } from "#/ui/button.tsx";

export const Route = createFileRoute("/app")({
  component: AppPage,
  head: () => ({ meta: [{ title: "Mein Studienbuch" }] }),
});

function AppPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<AccountView>();
  const [error, setError] = useState<string>();
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    void loadAccount()
      .then((result) => {
        if (result.ok) setAccount(result.value);
        else void navigate({ to: "/anmelden", search: {} });
      })
      .catch(() => navigate({ to: "/anmelden", search: {} }));
  }, [navigate]);

  const addPasskey = async () => {
    setPasskeyBusy(true);
    setError(undefined);
    const result = await authClient.passkey.addPasskey({ name: "Mein Passkey" });
    setPasskeyBusy(false);
    if (result.error !== null) setError("Der Passkey konnte nicht hinzugefügt werden.");
  };

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

        <section className="mt-10">
          <p className="text-sm font-semibold text-primary-text">Mein Konto</p>
          <h1 className="mt-1 text-4xl text-ink">
            {account === undefined
              ? "Studienbuch"
              : `Hallo${account.accesses[0]?.displayName ? `, ${account.accesses[0].displayName}` : ""}!`}
          </h1>
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

        <section className="mt-8 grid gap-5 sm:grid-cols-2">
          {account?.accesses.map((access) => (
            <article className="rounded-card bg-white p-6 shadow-card" key={access.id}>
              <div className="flex items-center gap-3 text-primary-text">
                <School />
                <h2 className="text-xl">{access.schoolName}</h2>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                {access.kind === "Student" ? "Schülerzugang" : "Lehrerzugang"}
              </p>
              {access.displayName === null ? (
                <Button
                  className="mt-5"
                  onClick={() =>
                    void navigate({ to: "/einrichten", search: { access: access.id } })
                  }
                  radius="pill"
                  variant="brand"
                >
                  Profil einrichten
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
            <Button
              className="mt-5"
              onClick={() => void navigate({ to: "/aktivieren" })}
              radius="pill"
              variant="outline"
            >
              <Plus /> Zugangscode eingeben
            </Button>
          </article>
        </section>

        <section className="mt-8 rounded-card bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl">Passkeys</h2>
              <p className="mt-1 text-sm text-ink-soft">Melde dich künftig ohne Passwort an.</p>
            </div>
            <Button
              disabled={passkeyBusy}
              onClick={() => void addPasskey()}
              radius="pill"
              variant="outline"
            >
              <KeyRound /> {passkeyBusy ? "Wird erstellt ..." : "Passkey hinzufügen"}
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
