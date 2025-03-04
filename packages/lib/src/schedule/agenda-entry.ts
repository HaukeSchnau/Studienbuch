import type { SubjectId } from "../courses";
import type { SubstitutionType } from "../substitutions";
import type { Salutation } from "../users";

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
