import type { ReactNode } from "react";

/**
 * The frame a destination's content sits in, so that every screen in the shell shares one measure
 * and one rhythm rather than each inventing its own padding.
 *
 * No entrance animation. The landing page's `enter` classes are a one-time arrival for a page seen
 * once; here they fired again on every switch between destinations, so reaching "Meine Woche" cost
 * 620ms of fade-and-rise before anything could be read — every time, forever. Motion in the
 * application is reserved for feedback: something worked, something failed, something is working.
 *
 * The measure is tighter than the marketing pages too. Airiness sells a product; it does not help
 * someone read a timetable, and these screens have to hold a week grid and a list of grades.
 */
export const DestinationPage = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) => (
  <main className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
    <h1 className="text-2xl text-primary-text">{title}</h1>
    <div className="mt-5">{children}</div>
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
  <div className="rounded-card border-2 border-dashed border-primary-pale bg-white/60 px-6 py-8 text-center">
    <p className="mx-auto max-w-md text-sm text-ink-soft text-pretty">{children}</p>
    <p className="mt-3 text-sm font-semibold text-primary-text">Wird gerade gebaut.</p>
  </div>
);
