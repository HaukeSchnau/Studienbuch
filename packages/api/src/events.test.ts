import { expect, it } from "vitest";

import type { Event } from "@stu/lib";
import { db } from "@stu/db/client";
import { Result } from "@stu/lib";

import { ingest } from "./router/events/ingest";
import { subscribe } from "./router/events/subscribe";

const myUserId = crypto.randomUUID();

expect.extend({
  toBeOk(received) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      pass: Result.isOk(received),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      message: () => `Result is error: ${received.error}`,
    };
  },
});

it("should sign up", async () => {
  const receivedEvents: Event[] = [];
  const consumer = await subscribe(myUserId, undefined, (event) => {
    console.log(">>> EVENT", event);
    receivedEvents.push(event);
  });

  expect(
    await ingest(
      "auth.licenseActivated",
      {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        data: {
          licenseKey: "KJ27-MP16-LS14-JM22",
          userId: myUserId,
        },
      },
      myUserId,
    ),
  ).toBeOk();

  expect(
    await ingest(
      "student.joined",
      {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        data: {
          studentId: myUserId,
          school: "igs-lil",
          name: "John Doe",
          class: {
            startYear: 2017,
            identifier: "",
          },
          isOfAge: true,
        },
      },
      myUserId,
    ),
  ).toBeOk();

  const someCourse = await db.query.Courses.findFirst();
  if (!someCourse) throw new Error("No course found");
  expect(
    await ingest(
      "student.courseAssigned",
      {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        data: {
          studentId: myUserId,
          courseId: someCourse.id,
        },
      },
      myUserId,
    ),
  ).toBeOk();

  // Wait for the events to be processed
  await new Promise((resolve) => setTimeout(resolve, 100));
  await consumer.close();

  expect(receivedEvents).toContainEqual({
    data: {
      licenseKey: "KJ27-MP16-LS14-JM22",
      userId: myUserId,
    },
    errors: ["EXISTS", "INVALID_LICENSE_KEY"],
    id: expect.any(String),
    timestamp: expect.any(Date),
    type: "auth.licenseActivated",
  });

  expect(receivedEvents).toContainEqual({
    data: {
      class: {
        identifier: "",
        startYear: 2017,
      },
      isOfAge: true,
      name: "John Doe",
      school: "igs-lil",
      studentId: myUserId,
    },
    errors: ["NOT_ALLOWED", "INVALID_CLASS"],
    id: expect.any(String),
    timestamp: expect.any(Date),
    type: "student.joined",
  });

  expect(receivedEvents).toContainEqual({
    data: {
      studentId: myUserId,
      courseId: someCourse.id,
    },
    errors: ["ALREADY_ASSIGNED", "NOT_ALLOWED", "INVALID_COURSE"],
    id: expect.any(String),
    timestamp: expect.any(Date),
    type: "student.courseAssigned",
  });
});
