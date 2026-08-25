import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";

export const AuthShell = ({ children }: { readonly children: ReactNode }) => (
  <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-primary-des px-5 py-12">
    <div aria-hidden className="absolute -top-24 -left-28 size-72 rounded-full bg-[#9DBFEC]/55" />
    <div aria-hidden className="absolute top-1/3 -right-24 size-64 rounded-full bg-[#92C78E]/60" />
    <div
      aria-hidden
      className="absolute -bottom-32 left-1/4 size-72 rounded-full bg-[#CA9093]/45"
    />
    <div className="relative w-full max-w-md">
      <Link className="mb-7 flex justify-center" to="/">
        <Wordmark />
      </Link>
      <section className="rounded-card-lg bg-white p-7 shadow-card-lg sm:p-9">{children}</section>
      <nav
        className="mt-6 flex justify-center gap-5 text-sm text-ink-soft"
        aria-label="Rechtliches"
      >
        <Link className="hover:text-ink" to="/impressum">
          Impressum
        </Link>
        <Link className="hover:text-ink" to="/datenschutz">
          Datenschutz
        </Link>
      </nav>
    </div>
  </main>
);

export const AuthError = ({ children }: { readonly children: ReactNode }) => (
  <p className="rounded-2xl bg-danger-des px-4 py-3 text-sm text-danger-sec" role="alert">
    {children}
  </p>
);

export const Field = ({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) => (
  <label className="grid gap-2 text-sm font-medium text-ink">
    {label}
    {children}
  </label>
);
