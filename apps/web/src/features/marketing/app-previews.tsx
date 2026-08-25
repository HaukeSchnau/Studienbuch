import { useEffect, useState } from "react";
import { Check, WifiOff } from "lucide-react";

/**
 * Small rebuilds of the app's own surfaces, used instead of icons on the feature cards.
 *
 * They are hand-built rather than cropped screenshots so they stay sharp, stay in the brand's type,
 * and can be read by nobody — each is decorative, and the card's prose carries the meaning.
 */

/**
 * Today's weekday in German, or "Heute" until the browser has told us.
 *
 * Resolved in an effect rather than during render: the server renders once, possibly in a different
 * timezone and possibly hours earlier if the response is cached, and a hydration mismatch over a
 * decorative label is not a trade worth making. The fallback is a real word, so nothing flickers
 * from empty to filled.
 */
function useWeekday(): string {
  const [weekday, setWeekday] = useState("Heute");

  useEffect(() => {
    setWeekday(new Date().toLocaleDateString("de-DE", { weekday: "long" }));
  }, []);

  return weekday;
}

/**
 * The day's agenda, with the middle lesson cancelled.
 *
 * This replaced an abstract grid of coloured blocks. The grid looked like a timetable but could not
 * say the one thing this card is about — that you learn first period is off before you leave the
 * house. A lesson striking itself out as "(Entfall)" arrives can.
 */
export const SchedulePreview = () => {
  const weekday = useWeekday();
  const agenda = [
    { time: "09:45", subject: "Englisch", teacher: "RUD", cancelled: false },
    { time: "11:30", subject: "Deutsch", teacher: "Frau Bembenek", cancelled: true },
    { time: "13:50", subject: "Seminarfach", teacher: "KLÄ", cancelled: false },
  ] as const;

  return (
    <div aria-hidden className="flex w-full flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card">
      <p className="px-0 pb-1 text-xs font-bold text-neutral">{weekday}</p>
      {agenda.map((lesson) => (
        <div className="flex items-baseline gap-3 py-1.5" key={lesson.time}>
          <span className="w-12 shrink-0 text-xs text-neutral tabular-nums">{lesson.time}</span>
          <span className="min-w-0 flex-1">
            <span className="relative inline-block">
              <span
                className={
                  lesson.cancelled ? "font-bold text-danger" : "font-bold text-primary-text"
                }
              >
                {lesson.subject}
              </span>
              {lesson.cancelled ? (
                // Its own element rather than `line-through`, because a text decoration cannot be
                // drawn across; a scaled bar can.
                <span className="draw-strike absolute inset-x-0 top-1/2 h-0.5 origin-left bg-danger" />
              ) : null}
            </span>
            {lesson.cancelled ? (
              <span className="fade-late ml-2 text-sm font-bold text-danger">(Entfall)</span>
            ) : null}
            <span className="block text-xs text-ink-soft">{lesson.teacher}</span>
          </span>
        </div>
      ))}
    </div>
  );
};

/** The grade row from a course page: points, kind, and the confirmation badge. */
export const GradePreview = () => (
  <div aria-hidden className="rounded-2xl bg-surface p-5 shadow-card">
    <div className="flex items-baseline gap-2">
      <span className="tick-in inline-block text-4xl font-bold text-ink tabular-nums">12</span>
      <span className="text-xl font-bold text-ink-soft">Punkte</span>
    </div>
    <p className="mt-0.5 text-sm text-ink-soft">mündlich · Stand 16.05.</p>
    <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary-text">
      <span className="tick-in grid size-4 place-items-center rounded-full bg-primary text-[0.6rem] text-white">
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
              ? "tick-in grid size-5 shrink-0 place-items-center rounded-md bg-primary text-[0.65rem] text-white"
              : "size-5 shrink-0 rounded-md border-2 border-neutral-sec"
          }
        >
          {task.done ? "✓" : null}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-bold text-primary-text">{task.subject}</span>
          {task.done ? (
            <span className="relative inline-block text-neutral">
              {" "}
              {task.text}
              <span className="draw-strike absolute inset-x-0 top-1/2 h-px origin-left bg-neutral" />
            </span>
          ) : (
            <span className="text-ink"> {task.text}</span>
          )}
        </span>
      </div>
    ))}
  </div>
);
