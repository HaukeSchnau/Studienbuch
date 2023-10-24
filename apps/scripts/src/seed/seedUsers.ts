import { db, type Role } from "@acme/db";

import iservUsers from "../../iservUsers.json";
import { generateHashedPassword } from "./seedUtil/generateHashedPassword";

export const seedUsers = async () => {
  for (const user of iservUsers) {
    const newUser = await db.user.create({
      data: {
        email: `${user.username}@igslilienthal.de`,
        passwordHash: await generateHashedPassword(),
        name: user.name,
        role: (user.role = user.role as Role | undefined) ?? "STUDENT",
        title: user.title,
      },
    });
    console.log(newUser);
  }
};
