import type { SchoolId } from "../schools";

export interface Class {
  identifierInYear: string;
  startYear: number;
  school: SchoolId;
}
