import { Wordmark } from "./wordmark.tsx";

/**
 * What the router shows while a route is still working out what it needs.
 *
 * There was no pending component at all, so any wait past the router's threshold — `/app` awaiting
 * the account before it can decide which context to open — showed an empty white page. A blank
 * screen and a broken one look identical, and this is the first thing anybody sees after signing in.
 *
 * Deliberately not a skeleton of the shell. A skeleton promises a particular layout, and this
 * renders for every route in the application including the public ones; the mark and a line of text
 * are true everywhere.
 */
export const LoadingState = () => (
  <div className="grid min-h-screen place-items-center bg-primary-des px-6">
    <div className="text-center">
      <Wordmark />
      <p aria-live="polite" className="mt-4 text-sm text-ink-soft">
        <span className="working">Wird geladen ...</span>
      </p>
    </div>
  </div>
);
