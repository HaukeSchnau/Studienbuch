import { createRouter } from "../../trpc";
import { join } from "./join";
import { listChoices } from "./list-choices";

export const courses = createRouter({
  listChoices,
  join,
});
