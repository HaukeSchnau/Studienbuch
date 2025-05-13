import { z } from "zod";

export const SUBJECT_IDS = [
  "de",
  "en",
  "ma",
  "ph",
  "ch",
  "bi",
  "if",
  "ge",
  "pw",
  "mu",
  "sp",
  "ku",
  "re",
  "wn",
  "fr",
  "la",
  "sn",
  "sport-theorie",
  "sf",
  "tutorium",
  "ds",
  "ek",
  "nw",
  "gsl",
  "theo",
  "awt",
  "igl",
  "sw",
  "swb",
  "lp",
  "kr",
  "wpk",
  "wal",
  // "will-an-lili",
  // "präsenz",
  "bläser_k",
  "nachhaltigkeit",
] as const;
export type SubjectId = (typeof SUBJECT_IDS)[number];

const subjectNameToIdMap: Record<string, SubjectId> = {
  informatik: "if",
  "politik-wirtschaft": "pw",
  "darstellendes spiel": "ds",
  "werte und normen": "wn",

  // "will-an-lili 10": "will-an-lili",
  // "will-an-lili 8": "will-an-lili",
  // "will-an-lili 9": "will-an-lili",
};

export const subjectNameMap: Record<SubjectId, string> = {
  de: "Deutsch",
  en: "Englisch",
  ma: "Mathe",
  ph: "Physik",
  ch: "Chemie",
  bi: "Biologie",
  if: "Informatik",
  ge: "Geschichte",
  pw: "Politik-Wirtschaft",
  mu: "Musik",
  sp: "Sport",
  ku: "Kunst",
  re: "Religion",
  wn: "Werte und Normen",
  fr: "Französisch",
  la: "Latein",
  sn: "Spanisch",
  "sport-theorie": "Sport-Theorie",
  sf: "Seminarfach",
  tutorium: "Tutorium",
  ds: "Darstellendes Spiel",
  ek: "Erdkunde",
  nw: "Naturwissenschaften",
  gsl: "Gesellschaftslehre",
  theo: "THEO",
  awt: "AWT",
  igl: "IGL",
  sw: "SW",
  swb: "SWB",
  lp: "LP",
  kr: "KR",
  wpk: "Wahlpflichtkurs",
  // "will-an-lili": "Will an Lili",
  // präsenz: "Präsenz",
  bläser_k: "Bläserklasse",
  nachhaltigkeit: "Nachhaltigkeit",
  wal: "WAL",
};

export const guessSubject = (name: string): SubjectId | null => {
  const nameLower = name.toLowerCase();
  if (subjectNameToIdMap[nameLower]) {
    return subjectNameToIdMap[nameLower];
  }

  const subjectSchema = z.enum(SUBJECT_IDS);
  let parsedSubject = subjectSchema.safeParse(nameLower);
  if (parsedSubject.success) {
    return parsedSubject.data;
  }

  const [, subjectId2] = /^([a-z]{2})/.exec(nameLower) ?? [];
  if (subjectId2) {
    parsedSubject = subjectSchema.safeParse(subjectId2);
    if (parsedSubject.success) {
      return parsedSubject.data;
    }

    if (subjectNameToIdMap[subjectId2]) {
      return subjectNameToIdMap[subjectId2];
    }
  }

  const [, subjectId3] = /^([a-z]{3})/.exec(nameLower) ?? [];
  if (subjectId3) {
    parsedSubject = subjectSchema.safeParse(subjectId3);
    if (parsedSubject.success) {
      return parsedSubject.data;
    }

    if (subjectNameToIdMap[subjectId3]) {
      return subjectNameToIdMap[subjectId3];
    }
  }

  parsedSubject = subjectSchema.safeParse(nameLower.substring(0, 2));
  if (parsedSubject.success) {
    return parsedSubject.data;
  }

  return null;
};

// TODO: Consider adding these explicitly
// "wpk sport": "none",
// "wpk hw": "none",
// "wpk ds": "none",
// "wpk hiking": "none",
// "wpk lerncoaching": "none",
// "wpk fitness": "none",
// "wpk gesund&sozial": "none",
// "wpk event": "none",
// "wpk o": "none",
// "wpk werken": "none",
// "wpk kreativ": "none",
// "wpk yoga": "none",
// "wpk ballspiele": "none",
// "wpk handarbeiten": "none",
// "wpk chor": "none",
// "wpk harry potter": "none",
// "wpk die welt im klei": "none",
// "wpk kunst": "none",
// "wpk afrika": "none",
// "wpk schulgarten": "none",
// "wpk zeichnen": "none",
// "wpk daz-d": "none",
// "wpk daz-m": "none",
// "wpk glück und gesund": "none",
// "wpk zeitung": "none",
// "wpk musik": "none",
// "wpk länder": "none",
// "wpk ernährung": "none",
// "wpk durchblick": "none",
// "wpk do it yourself": "none",
// "wpk selbstverteidigu": "none",
// "wpk programmieren": "none",
// "wpk nachhaltigkeit": "none",
// "wpk sport jungen": "none",
// "wpk lwo": "none",
// "wpk film": "none",
// "wpk erfindungen": "none",
// "wpk glück ist...": "none",
// "wpk tiral&error": "none",
// "wpk tanzen": "none",
// "wpk fußball": "none",
// "wpk chinesisch": "none",
// "wpk schule gestalten": "none",
// "wpk schülerfirma": "none",
