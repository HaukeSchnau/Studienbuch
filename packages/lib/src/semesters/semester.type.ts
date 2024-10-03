export interface Semester {
  name: string;
  start: Date;
  end: Date;
  type: "SUMMER" | "WINTER";
  year: number;
}
