export interface Substitution {
  date: Date;
  type: SubstitutionType | null;
}

export type SubstitutionType =
  | "FREISETZUNG"
  | "VERTRETUNG"
  | "BETREUUNG"
  | "ENTFALL"
  | "TROTZ_ABSENZ";
