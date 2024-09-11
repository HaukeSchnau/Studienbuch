export interface Substitution {
  date: Date;
  type: SubstitutionType | null;
}

export const SUBSTITUTION_TYPES = [
  "FREISETZUNG",
  "VERTRETUNG",
  "BETREUUNG",
  "ENTFALL",
  "TROTZ_ABSENZ",
] as const;

export type SubstitutionType = (typeof SUBSTITUTION_TYPES)[number];
