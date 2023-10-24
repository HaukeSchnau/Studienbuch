import fs from "fs/promises";
import Papa from "papaparse";

import { db } from "@acme/db";

const extractUnknownUsers = async () => {
  const users = await db.user.findMany({
    where: {
      role: "TEACHER",
    },
    select: {
      abbrv: true,
      name: true,
      title: true,
    },
  });

  const modifiedUsers = users.map((user) => {
    if(user.abbrv === user.name) {
        return {
            ...user,
            name: "",
        };
    }

    return user;
  });

  const csv = Papa.unparse(modifiedUsers);

  await fs.writeFile("known-users.csv", csv);
};

void extractUnknownUsers();
