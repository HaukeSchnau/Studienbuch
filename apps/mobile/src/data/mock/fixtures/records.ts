import type { Absence, Grade, Task, TaskAttachment } from "@stu/core";
import { addDays } from "date-fns";
import { Image } from "react-native";
import { mockNow } from "../mock-clock";
import { mockSignatureSvg } from "../mock-signatures";

const poetryNotesUri = Image.resolveAssetSource(
  require("../../../assets/homework/poetry-notes.png"),
).uri;
const analysisBoardUri = Image.resolveAssetSource(
  require("../../../assets/homework/analysis-board.png"),
).uri;
const analysisSketchUri = Image.resolveAssetSource(
  require("../../../assets/homework/analysis-sketch.png"),
).uri;

const attachment = (id: string, label: string, color: string, uri?: string): TaskAttachment => ({
  id,
  label,
  color,
  uri,
});

export const gradesSeed: Grade[] = [
  {
    id: "g-master-1",
    courseId: "de-1",
    type: "MASTER",
    result: 11,
    date: addDays(mockNow, -14),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: null,
  },
  {
    id: "g-oral-1",
    courseId: "de-1",
    type: "ORAL",
    result: 12,
    date: addDays(mockNow, -7),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-1",
    courseId: "de-1",
    type: "WRITTEN",
    result: 10,
    date: addDays(mockNow, -28),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-2",
    courseId: "de-1",
    type: "WRITTEN",
    result: 13,
    date: addDays(mockNow, -3),
    teacherSignature: null,
    parentSignature: null,
  },
  {
    id: "g-master-ma",
    courseId: "ma-1",
    type: "MASTER",
    result: 12,
    date: addDays(mockNow, -10),
    teacherSignature: mockSignatureSvg("N. Petersen"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-oral-ma",
    courseId: "ma-1",
    type: "ORAL",
    result: 13,
    date: addDays(mockNow, -5),
    teacherSignature: mockSignatureSvg("N. Petersen"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-ma",
    courseId: "ma-1",
    type: "WRITTEN",
    result: 11,
    date: addDays(mockNow, -24),
    teacherSignature: mockSignatureSvg("N. Petersen"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-master-en",
    courseId: "en-1",
    type: "MASTER",
    result: 10,
    date: addDays(mockNow, -12),
    teacherSignature: mockSignatureSvg("T. Kruse"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-oral-en",
    courseId: "en-1",
    type: "ORAL",
    result: 10,
    date: addDays(mockNow, -9),
    teacherSignature: mockSignatureSvg("T. Kruse"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-en",
    courseId: "en-1",
    type: "WRITTEN",
    result: 9,
    date: addDays(mockNow, -20),
    teacherSignature: mockSignatureSvg("T. Kruse"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-master-ge",
    courseId: "ge-1",
    type: "MASTER",
    result: 13,
    date: addDays(mockNow, -18),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-oral-ge",
    courseId: "ge-1",
    type: "ORAL",
    result: 14,
    date: addDays(mockNow, -11),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-ge",
    courseId: "ge-1",
    type: "WRITTEN",
    result: 12,
    date: addDays(mockNow, -26),
    teacherSignature: mockSignatureSvg("A. Meyer"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-oral-ph",
    courseId: "ph-1",
    type: "ORAL",
    result: 9,
    date: addDays(mockNow, -8),
    teacherSignature: mockSignatureSvg("L. Becker"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-written-ph",
    courseId: "ph-1",
    type: "WRITTEN",
    result: 10,
    date: addDays(mockNow, -17),
    teacherSignature: mockSignatureSvg("L. Becker"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
  {
    id: "g-master-sp",
    courseId: "sp-1",
    type: "MASTER",
    result: 14,
    date: addDays(mockNow, -21),
    teacherSignature: mockSignatureSvg("T. Kruse"),
    parentSignature: mockSignatureSvg("Erziehungsberechtigt"),
  },
];

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

export const tasksSeed: Task[] = [
  {
    id: "task-1",
    courseId: "de-1",
    title: "Gedichtanalyse fertigstellen",
    description:
      "Schreibe die Einleitung und den Hauptteil zu 'Der Panther' aus und markiere drei Stilmittel in deinem Heft.",
    dueDate: addDays(mockNow, 1),
    done: false,
    attachments: [attachment("task-1-a", "Foto 1", "#B9D7F5", poetryNotesUri)],
  },
  {
    id: "task-2",
    courseId: "ma-1",
    title: "Analysis Blatt 7",
    description:
      "Aufgaben 3 bis 6 rechnen und den Rechenweg vollständig notieren. Schwerpunkt: Kurvendiskussion.",
    dueDate: addDays(mockNow, 3),
    done: false,
    attachments: [
      attachment("task-2-a", "Tafelbild", "#F5D9B9", analysisBoardUri),
      attachment("task-2-b", "Skizze", "#D7E9C6", analysisSketchUri),
    ],
  },
  {
    id: "task-3",
    courseId: "ph-1",
    title: "Versuchsprotokoll hochladen",
    description:
      "Das Protokoll zum Fadenpendel sauber übertragen und die Messreihe mit Auswertung ergänzen.",
    dueDate: addDays(mockNow, -1),
    done: true,
    attachments: [],
  },
];
