export interface User {
  id: string;
  email: string | null;
  primaryRole: "TEACHER" | "STUDENT" | null;
  isSuperUser: boolean;
}

export const SALUTATIONS = ["Herr", "Frau"] as const;
export type Salutation = (typeof SALUTATIONS)[number];
