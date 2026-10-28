import { Homework } from "./Homework.ts";
// oxlint-disable-next-line studienbuch/module-shape -- fixture: a namespace import of our module
import * as Absence from "./Absence.ts";
// oxlint-disable-next-line studienbuch/module-shape -- fixture: a member import from a module
import { name } from "./Course.ts";
// oxlint-disable-next-line studienbuch/module-shape -- fixture: a namespace import of a workspace package
import * as Core from "@stu/core";

// oxlint-disable-next-line studienbuch/module-shape -- fixture: a namespace re-export of our module
export * as Grades from "./Grade.ts";

// oxlint-disable-next-line studienbuch/module-shape -- fixture: a member re-export from a module
export { title } from "./Homework.ts";

export const report = [Homework.title, Absence.reason, name, Core];
