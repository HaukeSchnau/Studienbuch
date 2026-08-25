import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EdgeBlob } from "#/domain-ui/brand/blobs.tsx";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";

/**
 * The frame every account screen sits in.
 *
 * The blobs are the site's own, not three circles drawn to look like them: these pages are one
 * click from the landing page and have to belong to it, and a second set of shapes would drift out
 * of step the first time the real ones change. `isolate` keeps their negative layer inside this
 * element instead of dropping behind the page.
 */
export const AuthShell = ({ children }: { readonly children: ReactNode }) => (
  <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-primary-des px-5 py-12">
    <EdgeBlob
      blob="legacyGreen"
      className="-left-24 top-[10%] h-[24rem] w-[15rem] sm:-left-28 sm:h-[34rem] sm:w-[22rem]"
      duration={27}
      offset={0}
      tone="green"
    />
    <EdgeBlob
      blob="legacyBlue"
      className="-right-24 bottom-[4%] h-[26rem] w-[15rem] sm:-right-28 sm:h-[38rem] sm:w-[24rem]"
      duration={33}
      offset={0.4}
      tone="blue"
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

/**
 * The one error region a form has, at a fixed id so its fields can point at it.
 *
 * One region rather than one per field because these forms fail as a whole — a sign-in does not
 * know which of the two values was wrong, and pretending otherwise would be a guess.
 */
export const authErrorId = "auth-error";

export const AuthError = ({ children }: { readonly children: ReactNode }) => (
  <p
    className="rounded-2xl bg-danger-des px-4 py-3 text-sm text-danger-sec"
    id={authErrorId}
    role="alert"
  >
    {children}
  </p>
);

/**
 * What a field says about itself while the form is showing an error.
 *
 * Spread onto every input in the form: without it a screen reader announces the message but never
 * connects it to anything the user can go back and change.
 */
export const invalidWhen = (error: string | undefined) =>
  error === undefined
    ? undefined
    : ({ "aria-invalid": true, "aria-describedby": authErrorId } as const);

export const Field = ({
  children,
  hint,
  label,
}: {
  readonly children: ReactNode;
  /** Shown under the field. For a rule the user would otherwise only learn by breaking it. */
  readonly hint?: string;
  readonly label: string;
}) => (
  <label className="grid gap-2 text-sm font-medium text-ink">
    {label}
    {children}
    {hint === undefined ? null : <span className="text-xs font-normal text-ink-soft">{hint}</span>}
  </label>
);

/**
 * The line under a form that offers the way out of it.
 *
 * Every account screen has one, because every one of them can be the wrong screen to be on: the
 * person with a code landed on the sign-in page, or the person with an account landed on the code
 * page. A screen that can be a dead end for someone is not finished.
 */
export const AuthNote = ({ children }: { readonly children: ReactNode }) => (
  <p className="mt-6 text-center text-sm text-ink-soft">{children}</p>
);

/**
 * How a note's call to action looks. A class rather than a wrapper component: `Link` resolves its
 * props from the generated route tree, and wrapping it would erase exactly the types that make a
 * mistyped destination a compile error.
 */
export const authNoteLinkClass = "font-semibold text-accent hover:underline";
