import { z } from "zod";

export const protoCourseSchema = z.object({
  subject: z.string(),
  guessedSubject: z.string(),
  teacher: z.string(),
  room: z.string().optional(),
});

export type ProtoCourse = z.infer<typeof protoCourseSchema>;

export interface ProtoCourseTime {
  weekday: number;
  start: number;
  duration: number;
  weeks: "ODD" | "EVEN" | "BOTH";
}

export type ExtendedProtoCourse = ProtoCourse & {
  isChoosable: boolean;
  normalizedCourseId: string;
};

export type ProtoCourseWithTimes = ExtendedProtoCourse & {
  times: ProtoCourseTime[];
};
