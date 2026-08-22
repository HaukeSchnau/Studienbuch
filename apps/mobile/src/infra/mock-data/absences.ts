import type { Absence } from "~/compat/mobile-v0";
import { addDays } from "date-fns";
import { mockNow } from "./clock";
import { mockSignatureSvg } from "./signatures";

export const absencesSeed: Absence[] = [
  {
    id: "a1",
    date: addDays(mockNow, -2),
    courseIds: ["ma-1", "de-1"],
    reason: "Arzttermin",
    parentSignature: null,
    teacherSignature: null,
  },
  {
    id: "a2",
    date: addDays(mockNow, -12),
    courseIds: ["en-1"],
    reason: "Erkältung",
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
    teacherSignature: mockSignatureSvg("T. Kruse"),
  },
];

export const createMockAbsenceSignature = (signer: "parent" | "teacher") =>
  mockSignatureSvg(signer === "parent" ? "Erziehungsberechtigt" : "Lehrkraft");
