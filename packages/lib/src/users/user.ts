export interface User {
  id: string;
  email: string | null;
  isSuperUser: boolean;
}

export const SALUTATIONS = ["Herr", "Frau"] as const;
export type Salutation = (typeof SALUTATIONS)[number];

export const PERSON_ROLES = ["STUDENT", "TEACHER"] as const;
export type PersonRole = (typeof PERSON_ROLES)[number];
