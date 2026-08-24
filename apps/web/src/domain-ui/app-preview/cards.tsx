import { Check, ChevronRight, Eye, Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "#/ui/cn.ts";

/**
 * A recreation of the native app's surfaces in markup, rather than a screenshot of them.
 *
 * Everything here is set at the app's own scale, so the same components can stand alone in a
 * feature collage and sit inside `PhoneFrame`, which shrinks them with `zoom`. That is the whole
 * reason these are components and not images: one set of sizes, two contexts, and no screenshot to
 * re-shoot when the app changes.
 *
 * The content is illustrative fixture data. Nothing here may import `@stu/core` — the marketing
 * page must not grow a dependency on the domain model.
 */

const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("rounded-card bg-surface p-4 shadow-card", className)}>{children}</div>
);

const CardTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h3 className={cn("text-lg font-bold text-primary-text", className)}>{children}</h3>
);

/** The round `+` affordance that sits in the corner of every list card in the app. */
const AddButton = ({ className }: { className?: string }) => (
  <span aria-hidden className={cn("text-primary", className)}>
    <Plus className="size-5" strokeWidth={3} />
  </span>
);

const lessons = [
  { time: "09:45 Uhr", subject: "Englisch", teacher: "RUD", cancelled: false },
  { time: "11:30 Uhr", subject: "Deutsch", teacher: "Frau Bembenek", cancelled: true },
  { time: "13:50 Uhr", subject: "Seminarfach", teacher: "KLÄ", cancelled: false },
] as const;

/**
 * Tomorrow's lessons. The cancelled row is the point of the whole card — it is the thing a paper
 * timetable structurally cannot tell you.
 */
export const DayPlanCard = ({ className }: { className?: string }) => (
  <Card className={cn("p-0", className)}>
    <div className="px-4 py-3 text-lg text-neutral">Freistunde</div>

    <ul>
      {lessons.map(({ time, subject, teacher, cancelled }) => (
        <li className="flex items-center gap-3 border-t border-neutral-sec px-4 py-3" key={subject}>
          <div className="grow">
            <div className="flex items-baseline gap-2">
              <span className="text-xs text-neutral">{time}</span>
              {cancelled ? <span className="text-xs font-bold text-danger">(Entfall)</span> : null}
            </div>
            <div
              className={cn(
                "text-lg font-bold text-primary-text",
                cancelled && "line-through decoration-2",
              )}
            >
              {subject}
            </div>
            <div className="text-sm text-ink-soft">{teacher}</div>
          </div>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-neutral" />
        </li>
      ))}
    </ul>
  </Card>
);

/** Outstanding absences, with the app's amber exclamation mark carried over as-is. */
export const AbsenceCard = ({ className }: { className?: string }) => (
  <Card className={cn("flex flex-col gap-3", className)}>
    <div className="flex items-start justify-between">
      <CardTitle>Fehlzeiten</CardTitle>
      <AddButton />
    </div>

    <div className="flex items-center gap-4">
      <img alt="" className="h-12 shrink-0" src="/app/warning.svg" />
      <p className="text-base/snug text-ink text-pretty">
        Du hast noch <strong>2 unentschuldigte</strong> Fehlzeiten an <strong>1 Tag</strong>.
      </p>
    </div>

    <span className="self-end rounded-full bg-accent px-5 py-2 text-sm font-bold text-white">
      Alle ansehen
    </span>
  </Card>
);

/**
 * The grade detail: oral and written kept apart, each with the state of its signatures. The
 * illustrations are the same files the native app uses.
 */
export const GradeCard = ({ className }: { className?: string }) => (
  <Card className={cn("flex flex-col gap-4", className)}>
    <CardTitle>Deine Noten</CardTitle>

    <div className="flex items-center gap-3">
      <img alt="" className="size-11 shrink-0" src="/app/oral.svg" />
      <div className="grow">
        <div className="text-2xl font-bold text-ink">12 Punkte</div>
        <div className="text-sm text-ink-soft">mündlich · Stand: 16.05.2026</div>
      </div>
      <Pencil aria-hidden className="size-5 shrink-0 text-neutral" />
    </div>

    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-full bg-primary-des px-3 py-1 text-sm font-bold text-primary-text">
        <Check aria-hidden className="size-4" strokeWidth={3} />
        Bestätigt
      </span>
      <Eye aria-hidden className="ml-auto size-5 text-neutral" />
    </div>

    <div className="flex items-center gap-3 border-t border-neutral-sec pt-4">
      <img alt="" className="size-11 shrink-0" src="/app/written.svg" />
      <div className="grow">
        <div className="text-2xl font-bold text-ink">9,5 Punkte</div>
        <div className="text-sm text-ink-soft">schriftlich</div>
      </div>
      <AddButton />
    </div>

    {/* The one item still waiting on a parent signature, in the app's danger tint. */}
    <div className="flex flex-col gap-2 rounded-card bg-danger-des p-3">
      <div className="text-sm font-bold text-ink">Klausur vom 16.05.2026</div>
      <div className="flex items-center gap-3 text-sm">
        <span className="flex items-center gap-1 font-bold text-primary-text">
          <Check aria-hidden className="size-4" strokeWidth={3} /> Lehrer
        </span>
        <span className="font-bold text-danger-sec">✕ Eltern</span>
      </div>
      <span className="self-start rounded-full border-2 border-danger px-4 py-1 text-sm font-bold text-danger">
        Jetzt bestätigen
      </span>
    </div>
  </Card>
);

const homework = [
  { subject: "Mathe", task: "S. 84, Nr. 3–7", due: "bis morgen" },
  { subject: "Biologie", task: "Foto vom Tafelbild", due: "bis Freitag" },
] as const;

/** Homework hangs off a course and is allowed to just be a photo of the blackboard. */
export const HomeworkCard = ({ className }: { className?: string }) => (
  <Card className={cn("flex flex-col gap-3 bg-accent-card", className)}>
    <div className="flex items-start justify-between">
      <CardTitle className="text-white">Hausaufgaben</CardTitle>
      <AddButton className="text-accent-pale" />
    </div>

    <ul className="flex flex-col gap-2">
      {homework.map(({ subject, task, due }) => (
        <li className="flex items-center gap-3" key={subject}>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent-pale" />
          <div className="grow">
            <div className="font-bold text-white">{subject}</div>
            <div className="text-sm text-accent-pale">{task}</div>
          </div>
          <span className="shrink-0 text-sm text-accent-pale">{due}</span>
        </li>
      ))}
    </ul>
  </Card>
);
