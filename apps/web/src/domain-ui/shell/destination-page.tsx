import type { ReactNode } from "react";

/**
 * The frame a destination's content sits in, so that every screen in the shell shares one measure
 * and one rhythm rather than each inventing its own padding.
 */
export const DestinationPage = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) => (
  <main className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
    <h1 className="enter text-3xl text-primary-text">{title}</h1>
    <div className="enter-late mt-6">{children}</div>
  </main>
);

/**
 * A destination that exists but has nothing in it yet.
 *
 * It says so, and says what will be here. The alternative — hiding the destination until its screen
 * is built — would mean the navigation changing shape as features land, so that nobody could learn
 * where anything lives. An empty room in the right place is more use than no room.
 */
export const NothingHereYet = ({ children }: { readonly children: ReactNode }) => (
  <div className="rounded-card border-2 border-dashed border-primary-pale bg-white/60 px-6 py-10 text-center">
    <p className="mx-auto max-w-md text-ink-soft text-pretty">{children}</p>
    <p className="mt-4 text-sm font-semibold text-primary-text">Wird gerade gebaut.</p>
  </div>
);
