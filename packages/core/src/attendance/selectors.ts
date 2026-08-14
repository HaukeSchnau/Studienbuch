import type { AbsenceCase, AbsenceStatus, MissedLesson } from "./model";

export const pendingMissedLessons = (absence: AbsenceCase): ReadonlyArray<MissedLesson> =>
  absence.missedLessons.filter((lesson) => lesson.decision._tag === "Pending");

export const excusedMissedLessons = (absence: AbsenceCase): ReadonlyArray<MissedLesson> =>
  absence.missedLessons.filter((lesson) => lesson.decision._tag === "Excused");

export const rejectedMissedLessons = (absence: AbsenceCase): ReadonlyArray<MissedLesson> =>
  absence.missedLessons.filter((lesson) => lesson.decision._tag === "Rejected");

export const absenceStatus = (absence: AbsenceCase): AbsenceStatus => {
  if (absence.acknowledgement === undefined) {
    return { _tag: "AwaitingAcknowledgement" };
  }

  const pending = pendingMissedLessons(absence).length;
  const excused = excusedMissedLessons(absence).length;
  const rejected = rejectedMissedLessons(absence).length;

  if (pending > 0 && excused + rejected === 0) {
    return { _tag: "AwaitingLessonDecisions", pending };
  }
  if (pending > 0) {
    return { _tag: "PartiallyResolved", excused, rejected, pending };
  }
  if (rejected === 0) return { _tag: "ResolvedExcused" };
  if (excused === 0) return { _tag: "ResolvedRejected" };
  return { _tag: "ResolvedMixed", excused, rejected };
};
