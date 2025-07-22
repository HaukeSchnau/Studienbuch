import { ingest, SYSTEM_USER } from "@stu/api";
import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Persons } from "@stu/db/schema";
import { IservClient } from "@stu/external-api";
import { Exit } from "effect";

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
      {
        type: "org.teacher.joined",
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

    if (Exit.isFailure(err)) {
      if (err.cause._tag === "Fail" && err.cause.error.reason === "DUPLICATE") {
        logger.info(`Teacher ${abbrv} already joined!`);
      } else {
        logger.error(`Could not ingest teacher joined event for ${abbrv}: ${err.cause.toString()}`);
      }
    } else {
      logger.info(`Teacher ${abbrv} joined!`);
    }

    return id;
  }
}
