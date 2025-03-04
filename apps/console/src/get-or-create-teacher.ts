import { ingest, SYSTEM_USER } from "@stu/api";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons } from "@stu/db/schema";
import { IservClient } from "@stu/external-api";
import { Result } from "@stu/lib";

import { logger } from "./logger";

export class ConsoleIservClient extends IservClient {
  async getOrCreateTeacher(abbrv: string) {
    const existingUser = await db.query.Persons.findFirst({
      where: eq(Persons.abbrv, abbrv),
    });

    if (existingUser) {
      return existingUser.id;
    }

    const iservUser = await this.findAbbrv(abbrv);

    const id = crypto.randomUUID();
    const firstName = iservUser?.name.split(" ").slice(0, -1).join(" ");
    const lastName = iservUser?.name.split(" ").at(-1);
    const err = await ingest(
      "org.teacher.joined",
      {
        data: {
          personId: id,
          firstName,
          lastName,
          abbrv,
          school: "igs-lil",
        },
        id,
        timestamp: new Date(),
      },
      SYSTEM_USER,
    );

    if (Result.isErr(err)) {
      if (err.error === "EXISTS") {
        logger.debug(`Teacher ${abbrv} already joined!`);
      } else {
        logger.error(
          `Could not ingest teacher joined event for ${abbrv}: ${err}`,
        );
      }
    } else {
      logger.info(`Teacher ${abbrv} joined!`);
    }

    return id;
  }
}
