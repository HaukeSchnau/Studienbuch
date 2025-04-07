import { queryOptions } from "@tanstack/react-query";

import { db } from "~/db/client";

export const currentStudent = () =>
  queryOptions({
    queryKey: ["currentStudent"],
    queryFn: () =>
      db.query.students.findFirst({
        with: {
          person: true,
          year: true,
          class: true,
        },
        columns: {
          person: false,
        },
      }),
  });
