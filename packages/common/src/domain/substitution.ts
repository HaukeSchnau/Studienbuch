export interface Substitution {
  date: Date;
  type: SubstitutionType | null;
}

export type SubstitutionType = string; // TODO: enum
