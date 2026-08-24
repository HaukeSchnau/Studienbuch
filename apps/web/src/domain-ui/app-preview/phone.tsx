import { ArrowLeft, CalendarDays, House, User, Wifi } from "lucide-react";
import type { ReactNode } from "react";

import {
  AbsenceCard,
  DayPlanCard,
  GradeCard,
  HomeworkCard,
} from "#/domain-ui/app-preview/cards.tsx";
import { AppHeaderBand } from "#/domain-ui/app-preview/header-band.tsx";
import { cn } from "#/ui/cn.ts";

/** The logical width the screens are laid out at, matching a phone's CSS pixel width. */
const SCREEN_WIDTH = 390;

/**
 * A device frame around one of the app screens.
 *
 * Scaling happens with `zoom` rather than `transform: scale()` so the frame still occupies its
 * scaled size in flow — with a transform the surrounding layout would keep reserving the full
 * 390px and leave a gap. Pass the scale through `className`, e.g. `[zoom:0.7] lg:[zoom:0.9]`.
 */
export const PhoneFrame = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    className={cn("shrink-0 rounded-[3.25rem] bg-notebook p-3 shadow-device", className)}
    style={{ width: SCREEN_WIDTH + 24 }}
  >
    <div
      className="relative flex flex-col overflow-hidden rounded-[2.5rem] bg-background"
      style={{ height: 780, width: SCREEN_WIDTH }}
    >
      {children}
    </div>
  </div>
);

/**
 * The scrollable area of a screen. Clipping here rather than on the frame is what keeps a tab bar
 * pinned to the bottom: content that overruns is cut off at the fold, exactly as it would be on a
 * phone, instead of pushing everything below it out of the device.
 */
const ScreenBody = ({ children }: { children: ReactNode }) => (
  <div className="grow overflow-hidden">{children}</div>
);

const StatusBar = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex items-center justify-between px-7 pt-3 text-sm font-bold text-white",
      className,
    )}
  >
    <span>7:45</span>
    <span className="flex items-center gap-1.5">
      <Wifi aria-hidden className="size-4" strokeWidth={2.5} />
      <span aria-hidden className="h-3.5 w-6 rounded-[3px] border-2 border-white/70">
        <span className="block h-full w-2/3 rounded-[1px] bg-white" />
      </span>
    </span>
  </div>
);

const TabBar = () => (
  <nav className="mt-auto flex items-end justify-around border-t border-neutral-sec bg-surface px-4 pt-2.5 pb-6">
    {[
      { icon: House, label: "Übersicht", active: true },
      { icon: CalendarDays, label: "Meine Woche", active: false },
      { icon: User, label: "Mein Profil", active: false },
    ].map(({ icon: Icon, label, active }) => (
      <span
        className={cn(
          "flex flex-col items-center gap-1 text-xs",
          active ? "font-bold text-primary" : "text-neutral",
        )}
        key={label}
      >
        <Icon aria-hidden className="size-6" strokeWidth={active ? 2.5 : 2} />
        {label}
      </span>
    ))}
  </nav>
);

/**
 * The app's header: the green band sits behind, and the content below is pulled up so the first
 * card rides across the curve the way it does natively.
 */
const AppHeader = ({ children }: { children: ReactNode }) => (
  // `isolate` traps the band's negative layer here, so it stays behind the header text but never
  // drops behind the screen's own background. Without the negative z-index the band, which is
  // taller than the header, would paint over the first card below it.
  <div className="relative isolate">
    <AppHeaderBand className="absolute inset-x-0 top-0 -z-10 h-56" />
    <StatusBar />
    <div className="px-6 pt-5 pb-8">{children}</div>
  </div>
);

/** The home screen: what is on tomorrow, what is still unexcused, what is due. */
export const OverviewScreen = () => (
  <>
    <ScreenBody>
      <AppHeader>
        <h2 className="text-3xl font-bold text-white">Moin, Hauke!</h2>
        <p className="text-lg text-white/90">Das steht morgen an:</p>
      </AppHeader>

      <div className="relative -mt-6 flex flex-col gap-4 px-4">
        <DayPlanCard />
        <AbsenceCard />
      </div>
    </ScreenBody>

    <TabBar />
  </>
);

/** A single course, opened on its grades. Homework hangs off the course, so it lives here too. */
export const CourseScreen = () => (
  <ScreenBody>
    <AppHeader>
      <div className="flex items-start gap-3">
        <ArrowLeft aria-hidden className="mt-2 size-6 shrink-0 text-white" strokeWidth={2.5} />
        <div className="grow">
          <h2 className="text-3xl font-bold text-white">Deutsch</h2>
          <p className="text-sm text-white/90">Sommer 2026/2027</p>
          <p className="text-sm text-white/90">Frau Bembenek</p>
        </div>
        <img
          alt=""
          className="size-14 shrink-0 rounded-2xl bg-surface p-1.5 shadow-card"
          src="/app/subject-de.svg"
        />
      </div>
    </AppHeader>

    <div className="relative -mt-4 flex flex-col gap-4 px-4">
      <GradeCard />
      <HomeworkCard />
    </div>
  </ScreenBody>
);
