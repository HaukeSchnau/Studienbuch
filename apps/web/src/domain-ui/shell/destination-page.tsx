import type { ComponentType, ReactNode } from "react";

/**
 * The frame a destination's content sits in, so that every screen in the shell shares one measure
 * and one rhythm rather than each inventing its own padding.
 *
 * One header for every destination, including the overview. That screen used to open with a green
 * greeting band while every other screen had a bare heading, which left no rule for which a new
 * screen should get; the greeting is now simply what the overview puts in its title, and `lead`
 * carries the line under it. Warmth belongs to the words, not to one screen's private chrome.
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
  lead,
  title,
}: {
  readonly children: ReactNode;
  /** The line under the heading: which school this is, whose week, what is being confirmed. */
  readonly lead?: string;
  readonly title: string;
}) => (
  <main className="mx-auto max-w-4xl px-5 py-6 sm:px-8">
    <h1 className="text-2xl text-primary-text">{title}</h1>
    {lead === undefined ? null : <p className="mt-1 text-sm text-ink-soft">{lead}</p>}
    <div className="mt-5">{children}</div>
  </main>
);

/**
 * A destination that exists but has nothing in it yet.
 *
 * It says so, and says what will be here. The alternative — hiding the destination until its screen
 * is built — would mean the navigation changing shape as features land, so that nobody could learn
 * where anything lives. An empty room in the right place is more use than no room.
 *
 * Each carries its destination's own icon, because five identical dashed rectangles made the whole
 * application read as one repeated placeholder: nothing distinguished the room you had arrived in
 * from the one you had just left.
 */
export const NothingHereYet = ({
  children,
  icon: Icon,
}: {
  readonly children: ReactNode;
  readonly icon: ComponentType<{ readonly className?: string }>;
}) => (
  <div className="rounded-card border-2 border-dashed border-primary-pale bg-white/60 px-6 py-8 text-center">
    <span
      aria-hidden
      className="mx-auto grid size-12 place-items-center rounded-full bg-primary-des text-primary-pale"
    >
      <Icon className="size-6" />
    </span>
    <p className="mx-auto mt-4 max-w-md text-sm text-ink-soft text-pretty">{children}</p>
    <p className="mt-3 text-sm font-semibold text-primary-text">Wird gerade gebaut.</p>
  </div>
);
