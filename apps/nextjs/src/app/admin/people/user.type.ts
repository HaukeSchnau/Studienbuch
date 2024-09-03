import type { Salutation } from "@stu/lib";

export interface Person {
  id: string;
  name: string;
  email: string | null;
  abbrv: string | null;
  salutation: Salutation | null;
}
