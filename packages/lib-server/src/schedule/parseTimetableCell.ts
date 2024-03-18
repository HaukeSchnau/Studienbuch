import type { ExtendedProtoCourse } from "@schnau/lib/src/schedule/import/ProtoCourse.type";
import { protoCourseSchema } from "@schnau/lib/src/schedule/import/ProtoCourse.type";
import { guessSubject } from "@schnau/lib/src/subject";

export const parseTimetableCell = (
  coursesRaw: string,
): ExtendedProtoCourse[] => {
  if (!coursesRaw) return [];

  const coursesForDay = coursesRaw
    .split("\n")
    .filter((course) => course.trim());

  const coursesForDayProcessed: ExtendedProtoCourse[] = [];

  for (let i = 0; i < coursesForDay.length; i++) {
    const course = coursesForDay[i];
    let components = course?.split(" ").filter((course) => course.trim()) ?? [];

    while (
      components.length == 1 ||
      (components.length < 3 &&
        !coursesForDay[i + 1]?.startsWith("*") &&
        i + 1 < coursesForDay.length)
    ) {
      components.push(
        ...(coursesForDay[i + 1]
          ?.split(" ")
          .filter((course) => course.trim()) ?? []),
      );
      i++;

      // TODO: Remove this once the PDF is fixed
      if (i > 50) {
        components = [];
      }
    }

    if (!components.length) {
      continue;
    }

    const [subject, teacher, room] = components;
    const guessedSubject = guessSubject(subject);

    const parsedProtoCourse = protoCourseSchema.parse({
      subject,
      guessedSubject,
      teacher,
      room,
    });

    coursesForDayProcessed.push({
      ...parsedProtoCourse,
      isChoosable: parsedProtoCourse.subject.startsWith("*"),
      normalizedCourseId: parsedProtoCourse.subject
        .replaceAll("*", "")
        .toLowerCase(),
    });
  }

  return coursesForDayProcessed;
};
