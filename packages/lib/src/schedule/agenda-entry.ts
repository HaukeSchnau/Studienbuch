import type { SubjectId } from "../courses";
import type { Salutation } from "../teacher";
import type { SubstitutionType } from "./substitution";

export interface AgendaEntry {
  start: Date;
  duration: number;
  course: {
    id: string;
    name: string;
    subject: SubjectId;
    teachers: {
      id: string;
      firstName: string;
      lastName: string;
      abbrv: string | null;
      salutation: Salutation | null;
    }[];
  };
  substitutions: {
    type: SubstitutionType | null;
    substitute: {
      id: string;
      firstName: string;
      lastName: string;
      abbrv: string | null;
      salutation: Salutation | null;
    } | null;
  }[];
}
