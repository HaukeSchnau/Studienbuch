import type { Student } from "../student";

export type StudentWithPersonRow = {
  person: {
    id: Student["id"];
    firstName: Student["firstName"];
    lastName: Student["lastName"];
  };
  school: Student["school"];
  classIdentifier: Student["class"]["identifier"];
  startYear: Student["class"]["startYear"];
  isOfAge: boolean | null;
};

export const mapStudentWithPersonRowToStudent = (row: StudentWithPersonRow): Student => ({
  id: row.person.id,
  firstName: row.person.firstName,
  lastName: row.person.lastName,
  school: row.school,
  class: {
    identifier: row.classIdentifier,
    startYear: row.startYear,
  },
  isOfAge: row.isOfAge ?? false,
});
