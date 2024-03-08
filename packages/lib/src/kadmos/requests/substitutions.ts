import { z } from "zod";

import { BASE_URL } from "./constants";
import { getFormat } from "./format";
import { buildSubstitutionsPayload } from "./payloadBuilder";

const buildSubstitutionsUrl = (school: string) =>
  `${BASE_URL}/substitution/data?school=${school}`;

const getSubstitutionsWithPayload = async (
  schoolName: string,
  payload: KadmosSubstitionsPayload,
): Promise<KadmosSubstitutions> => {
  const url = buildSubstitutionsUrl(schoolName);
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
  });
  const json = await response.json();

  return responseSchema.parse(json).payload;
};

export const getSubstitutionsFromKadmos = async (
  school: string,
  formatName: string,
  date: Date,
  hideCancelCausedByEvent = false,
) => {
  const payload = await getFormat(school, formatName);
  console.log(payload);
  const substitutionsPayload = buildSubstitutionsPayload(
    formatName,
    school,
    date,
    hideCancelCausedByEvent,
    payload,
  );
  return getSubstitutionsWithPayload(school, substitutionsPayload);
};

export interface KadmosSubstitionsPayload {
  formatName: string;
  schoolName: string;
  date: number;
  dateOffset: number;
  strikethrough: boolean;
  mergeBlocks: boolean;
  showOnlyFutureSub: boolean;
  showBreakSupervisions: boolean;
  showTeacher: boolean;
  showClass: boolean;
  showHour: boolean;
  showInfo: boolean;
  showRoom: boolean;
  showSubject: boolean;
  groupBy: number;
  hideAbsent: boolean;
  departmentIds: unknown[];
  departmentElementType: number;
  hideCancelWithSubstitution: boolean;
  hideCancelCausedByEvent: boolean;
  showTime: boolean;
  showSubstText: boolean;
  showAbsentElements: number[];
  showAffectedElements: number[];
  showUnitTime: boolean;
  showMessages: boolean;
  showStudentgroup: boolean;
  enableSubstitutionFrom: boolean;
  showSubstitutionFrom: number;
  showTeacherOnEvent: boolean;
  showAbsentTeacher: boolean;
  strikethroughAbsentTeacher: boolean;
  activityTypeIds: number[];
  showEvent: boolean;
  showCancel: boolean;
  showOnlyCancel: boolean;
  showSubstTypeColor: boolean;
  showExamSupervision: boolean;
  showUnheraldedExams: boolean;
}

const responseSchema = z.strictObject({
  payload: z.object({
    importInProgress: z.boolean(),
    date: z.number(),
    nextDate: z.number(),
    showingNextDate: z.boolean(),
    rows: z.array(
      z.union([
        z.object({
          data: z.array(z.string()),
          cssClasses: z.array(z.string()),
          cellClasses: z.object({}),
          group: z.null(),
        }),
        z.object({
          data: z.array(z.string()),
          cssClasses: z.array(z.string()),
          cellClasses: z.object({
            1: z.array(z.string()),
            2: z.array(z.string()),
            3: z.array(z.string()),
            4: z.array(z.string()),
          }),
          group: z.null(),
        }),
      ]),
    ),
    lastUpdate: z.string(),
    absentElements: z.array(z.unknown()).length(0),
    affectedElements: z.object({ 1: z.array(z.string()) }),
    messageData: z.object({
      messages: z.array(z.object({ subject: z.string(), body: z.string() })),
    }),
    weekDay: z.string(),
    regularFreeData: z.array(z.unknown()).length(0),
  }),
});

export type KadmosSubstitutions = z.infer<typeof responseSchema>["payload"];
