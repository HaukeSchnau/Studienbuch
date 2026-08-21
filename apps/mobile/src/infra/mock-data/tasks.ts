import type { Task, TaskAttachment } from "~/compat/mobile-v0";
import { addDays } from "date-fns";
import { Image } from "react-native";
import { mockNow } from "./clock";

const poetryNotesUri = Image.resolveAssetSource(
  require("../../assets/homework/poetry-notes.png"),
).uri;
const analysisBoardUri = Image.resolveAssetSource(
  require("../../assets/homework/analysis-board.png"),
).uri;
const analysisSketchUri = Image.resolveAssetSource(
  require("../../assets/homework/analysis-sketch.png"),
).uri;

const attachment = (id: string, label: string, color: string, uri?: string): TaskAttachment => ({
  id,
  label,
  color,
  uri,
});

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
