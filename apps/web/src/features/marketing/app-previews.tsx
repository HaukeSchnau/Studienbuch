import { Check, WifiOff } from "lucide-react";

import { subjectSamples } from "#/domain-ui/brand/subjects.ts";

/**
 * Small rebuilds of the app's own surfaces, used instead of icons on the feature cards.
 *
 * They are hand-built rather than cropped screenshots so they stay sharp, stay in the brand's type,
 * and can be read by nobody — each is decorative, and the card's prose carries the meaning.
 */

/** A week grid: coloured lesson blocks, one free period, one cancelled lesson struck through. */
export const SchedulePreview = () => {
  // Column-major, so each entry is one weekday. A null subject is a free period.
  const week = [
    {
      day: "monday",
      slots: [
        { period: "one", subject: 0 },
        { period: "two", subject: 4 },
        { period: "three", subject: 1 },
      ],
    },
    {
      day: "tuesday",
      slots: [
        { period: "one", subject: 2 },
        { period: "two", subject: 1 },
        { period: "three", subject: null },
      ],
    },
    {
      day: "wednesday",
      slots: [
        { period: "one", subject: 5 },
        { period: "two", subject: null },
        { period: "three", subject: 3 },
      ],
    },
    {
      day: "thursday",
      slots: [
        { period: "one", subject: 0 },
        { period: "two", subject: 3 },
        { period: "three", subject: 4 },
      ],
    },
    {
      day: "friday",
      slots: [
        { period: "one", subject: null },
        { period: "two", subject: 2 },
        { period: "three", subject: 5 },
      ],
    },
  ] as const;

  return (
    <div aria-hidden className="grid grid-cols-5 gap-1.5">
      {week.map((day) => (
        <div className="flex flex-col gap-1.5" key={day.day}>
          {day.slots.map((slot) =>
            slot.subject === null ? (
              <div className="h-9 rounded-lg bg-neutral-sec/60" key={slot.period} />
            ) : (
              <div
                className="h-9 rounded-lg"
                key={slot.period}
                style={{ backgroundColor: subjectSamples[slot.subject]?.color }}
              />
            ),
          )}
        </div>
      ))}
    </div>
  );
};

/** The grade row from a course page: points, kind, and the confirmation badge. */
export const GradePreview = () => (
  <div aria-hidden className="rounded-2xl bg-surface p-5 shadow-card">
    <div className="flex items-baseline gap-2">
      <span className="text-4xl font-bold text-ink">12</span>
      <span className="text-xl font-bold text-ink-soft">Punkte</span>
    </div>
    <p className="mt-0.5 text-sm text-ink-soft">mündlich · Stand 16.05.</p>
    <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary-text">
      <span className="grid size-4 place-items-center rounded-full bg-primary text-[0.6rem] text-white">
        ✓
      </span>
      Bestätigt
    </p>
  </div>
);

/** The absence warning, including the app's fat amber exclamation mark. */
export const AbsencePreview = () => (
  <div aria-hidden className="flex items-center gap-4 rounded-2xl bg-surface p-5 shadow-card">
    <span className="flex flex-col items-center gap-1">
      <span className="h-8 w-3 rounded-full bg-alert" />
      <span className="size-3 rounded-full bg-alert" />
    </span>
    <p className="text-sm/relaxed text-ink">
      Du hast noch <span className="font-bold">2</span> unentschuldigte Fehlzeiten an{" "}
      <span className="font-bold">1</span> Tag.
    </p>
  </div>
);

/**
 * The offline state, told as two chips: the connection is gone, the timetable is not. The joke is
 * the whole point of the section, so it is worth drawing rather than describing.
 */
export const OfflinePreview = () => (
  <div aria-hidden className="flex flex-wrap items-center gap-3">
    <span className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-sm font-bold text-neutral shadow-card">
      <WifiOff className="size-4" strokeWidth={2.5} />
      Kein Netz
    </span>
    <span className="text-xl font-bold text-white">→</span>
    {/* Deep ink, not the brand green: this chip sits on a green card, and white on that green is
        3.2:1 — invisible as a fill and unreadable as a label. */}
    <span className="flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-card">
      <Check className="size-4" strokeWidth={3} />
      Stundenplan trotzdem da
    </span>
  </div>
);

/** Two task rows, the finished one ticked off. */
export const TaskPreview = () => (
  <div aria-hidden className="flex flex-col gap-2">
    {[
      { done: true, subject: "Mathe", text: "S.\u00a084, Nr.\u00a03–7" },
      { done: false, subject: "Englisch", text: "Vokabeln Unit 6" },
    ].map((task) => (
      <div
        className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card"
        key={task.text}
      >
        <span
          className={
            task.done
              ? "grid size-5 shrink-0 place-items-center rounded-md bg-primary text-[0.65rem] text-white"
              : "size-5 shrink-0 rounded-md border-2 border-neutral-sec"
          }
        >
          {task.done ? "✓" : null}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-bold text-primary-text">{task.subject}</span>
          <span className={task.done ? "text-neutral line-through" : "text-ink"}> {task.text}</span>
        </span>
      </div>
    ))}
  </div>
);
