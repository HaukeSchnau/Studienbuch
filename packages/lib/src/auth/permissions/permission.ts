import type { PermissionScope } from "./scope";

export type Permission =
  | "EDIT_INFO_PAGES"
  | "EDIT_USERS"
  | "EDIT_COURSES"
  | "EDIT_YEARS"
  | "EDIT_CLASSES"
  | "EDIT_SCHOOLS"
  | "VIEW_LOGS";

export interface PermissionOnUser {
  permission: Permission;
  scope: PermissionScope | null;
}
