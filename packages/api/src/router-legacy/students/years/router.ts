import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";

import { eq } from "@stu/db";
import { db } from "@stu/db/client";
import { Students } from "@stu/db/schema";

import { protectedProcedure } from "../../../procedures";

export const years = {
  getOwn: protectedProcedure.query(
    async ({
      ctx: {
        session: { user },
      },
    }) => {
      const student = await db.query.Students.findFirst({
        where: eq(Students.person, user.id),
        with: {
          class: {
            with: {
              year: {
                with: {
                  school: true,
                },
              },
            },
          },
        },
      });

      if (!student) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Student not found",
        });
      }

      return student.class.year;
    },
  ),
} satisfies TRPCRouterRecord;
