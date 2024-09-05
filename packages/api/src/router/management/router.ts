import { createRouter } from "../../trpc";
import { persons } from "./persons/router";
import { schools } from "./schools/router";
import { users } from "./users/router";
import { years } from "./years/router";

export const management = createRouter({
  persons,
  schools,
  users,
  years,
});
