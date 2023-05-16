const courseNames = [
  "Deutsch",
  "Englisch",
  "Mathe",
  "Physik",
  "Chemie",
  "Biologie",
  "Informatik",
  "Geschichte",
  "Politik-Wirtschaft",
  "Musik",
  "Sport",
  "Kunst",
  "Religion",
  "Werte und Normen",
  "Französisch",
  "Latein",
  "Spanisch",
  "Sport-Theorie",
  "Seminarfach",
];

export const guessSubject = (subject: string | undefined) => {
  const regex = /^\*?([^0-9]+)[0-9]*$/;
  const matches = regex.exec(subject ?? "");

  if (!matches) return subject?.trim().replaceAll("*", "");

  const parsedSubject = matches[1];

  if (!parsedSubject) return subject?.trim().replaceAll("*", "");

  const subjectLower = parsedSubject.trim().toLowerCase();

  if (subjectLower.startsWith("wn") || subjectLower.startsWith("wun"))
    return "Werte und Normen";

  if (subjectLower === "ds") return "Darstellendes Spiel";
  if (subjectLower === "sn") return "Spanisch";
  if (subjectLower === "pw") return "Politik-Wirtschaft";
  if (subjectLower === "if") return "Informatik";
  if (subjectLower === "sf") return "Seminarfach";

  return (
    courseNames.find((candidate) =>
      candidate.toLowerCase().startsWith(subjectLower),
    ) ?? parsedSubject
  );
};
