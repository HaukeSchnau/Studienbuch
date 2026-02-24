import type { PermissionOnUser, Salutation } from "@stu/lib";

export interface User {
  id: string;
  email: string | null;
  hasPassword: boolean;
  roles: {
    id: string;
    name: string;
  }[];
  isSuperUser: boolean;
  permissions: PermissionOnUser[];
  person: {
    id: string;
    firstName: string;
    lastName: string;
    abbrv: string | null;
    salutation: Salutation | null;
  };
}
