import { prisma } from "@acme/db";

import iservUsers from "../iservUsers.json";

export const copyIservUsers = async () => {
  for (const user of iservUsers) {
    const newUser = await prisma.user.create({
      data: {
        email: `${user.username}@igslilienthal.de`,
        name: user.name,
      },
    });
    console.log(newUser);
  }
};
