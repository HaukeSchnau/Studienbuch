import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { EdgeBlob } from "#/domain-ui/brand/blobs.tsx";
import { Underlined } from "#/domain-ui/brand/underline.tsx";
import { Wordmark } from "#/domain-ui/brand/wordmark.tsx";
import { cn } from "#/ui/cn.ts";

/**
 * The frame every account screen sits in.
 *
 * The blobs are the site's own, not three circles drawn to look like them: these pages are one
 * click from the landing page and have to belong to it, and a second set of shapes would drift out
 * of step the first time the real ones change. `isolate` keeps their negative layer inside this
 * element instead of dropping behind the page.
 *
 * The card arrives rather than appearing, on the same clock-based entrance as the hero. A scroll
 * timeline would be wrong here: there is nothing to scroll on a screen that is one card tall, so
 * the movement has to be a one-time arrival or nothing at all.
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
      <Link className="enter mb-7 flex justify-center" to="/">
        <Wordmark />
      </Link>
      <section className="enter-late rounded-card-lg bg-white p-7 shadow-card-lg sm:p-9">
        {children}
      </section>
      <nav
        className="enter-later mt-6 flex justify-center gap-5 text-sm text-ink-soft"
        aria-label="Rechtliches"
      >
        <Link className="press hover:text-ink" to="/impressum">
          Impressum
        </Link>
        <Link className="press hover:text-ink" to="/datenschutz">
          Datenschutz
        </Link>
      </nav>
    </div>
  </main>
);

/**
 * The screen's title, written in the brand's own hand.
 *
 * The swoosh is the same stroke the headline and the nav use, and it draws itself last — so the
 * card settles, the words gain their weight, and then the sentence is finished. Three screens deep
 * into an enrollment, that is the only thing reminding someone whose product this is.
 */
export const AuthHeading = ({ children }: { readonly children: ReactNode }) => (
  <h1 className="enter-heading text-center text-3xl text-primary-text">
    <Underlined>{children}</Underlined>
  </h1>
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
    className="error-in rounded-2xl bg-danger-des px-4 py-3 text-sm text-danger-sec"
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
 * connects it to anything the user can go back and change. `aria-invalid` also rings the field in
 * the danger colour, which the input already knows how to do.
 */
export const invalidWhen = (error: string | undefined) =>
  error === undefined
    ? undefined
    : ({ "aria-invalid": true, "aria-describedby": authErrorId } as const);

/**
 * What a submit button says about itself while the form is failing or working.
 *
 * The flinch matters more than it looks: the message arrives below a button the eye is still on,
 * and a message that merely appears there is easy to miss. Spread onto the button.
 */
export const submitState = (options: {
  readonly busy: boolean;
  readonly error: string | undefined;
}) => ({
  "aria-busy": options.busy,
  disabled: options.busy,
  className: options.error === undefined ? undefined : "nudge",
});

/** A button label that reads as working rather than merely disabled. */
export const Working = ({ children }: { readonly children: ReactNode }) => (
  <span className="working">{children}</span>
);

/**
 * The tick the brand draws when something has landed.
 *
 * The same dash technique as the swoosh, so the moments of reassurance across the whole product are
 * written in one hand. Used wherever a screen's answer is "that worked" rather than "here is a form".
 */
export const AuthTick = ({ className }: { readonly className?: string }) => (
  <svg
    aria-hidden
    className={cn("confirm-tick size-12 text-primary", className)}
    fill="none"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M6 17l6.5 6.5L26 10"
      pathLength={1}
      stroke="currentColor"
      strokeDasharray={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.5"
    />
  </svg>
);

/** A screen whose whole content is good news. */
export const AuthDone = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) => (
  <div className="confirm-in">
    <AuthTick className="mx-auto" />
    <h1 className="mt-5 text-center text-3xl text-primary-text">{title}</h1>
    <div className="mt-4 text-center text-ink-soft">{children}</div>
  </div>
);

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
export const authNoteLinkClass = "press font-semibold text-accent hover:underline";
