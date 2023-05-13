import { prisma, type Role } from "@acme/db";

import iservUsers from "../../iservUsers.json";

export const seedUsers = async () => {
  for (const user of iservUsers) {
    const newUser = await prisma.user.create({
      data: {
        email: `${user.username}@igslilienthal.de`,
        name: user.name,
        role: (user.role = user.role as Role | undefined) ?? "STUDENT",
        title: user.title,
      },
    });
    console.log(newUser);
  }
};
