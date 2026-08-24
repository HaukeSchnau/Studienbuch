/**
 * Illustrative timetable data for the marketing page.
 *
 * Course colours are chosen per course by the school in the real product; these are a representative
 * spread taken from the production week view, used only so the decorative strip and the schedule
 * preview look like a real timetable. They are not a palette anything else should reference.
 */
export interface SubjectSample {
  /** Icon file under `public/subjects`, from the app's own illustrated set. */
  readonly icon: string;
  readonly color: string;
  readonly label: string;
}

export const subjectSamples: readonly SubjectSample[] = [
  { icon: "ma", color: "#8B1FA8", label: "Mathe" },
  { icon: "de", color: "#B4531B", label: "Deutsch" },
  { icon: "en", color: "#8B1FA8", label: "Englisch" },
  { icon: "bi", color: "#A0221F", label: "Biologie" },
  { icon: "ge", color: "#6FA82A", label: "Geschichte" },
  { icon: "if", color: "#1B3F9B", label: "Informatik" },
  { icon: "ch", color: "#0E9B8A", label: "Chemie" },
  { icon: "sp", color: "#C21FA8", label: "Sport" },
  { icon: "ku", color: "#B4531B", label: "Kunst" },
  { icon: "ph", color: "#1B3F9B", label: "Physik" },
  { icon: "mu", color: "#0E9B8A", label: "Musik" },
  { icon: "la", color: "#A0221F", label: "Latein" },
  { icon: "fr", color: "#6FA82A", label: "Französisch" },
  { icon: "re", color: "#4D75A8", label: "Religion" },
];
