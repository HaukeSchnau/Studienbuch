import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { z } from "zod";

import { BASE_URL } from "../constants";
import type { KadmosFormat } from "../format";
import { getFormat } from "../format";
import { buildSubstitutionsPayload } from "../payloadBuilder";

dayjs.extend(customParseFormat);

const buildSubstitutionsUrl = (school: string) => `${BASE_URL}/substitution/data?school=${school}`;

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

  return responseSchema.parse(await response.json()).payload;
};

export const getSubstitutionsFromKadmos = async (
  school: string,
  formatName: string,
  date: Date,
  hideCancelCausedByEvent = false,
  formatOverrides?: Partial<KadmosFormat>,
) => {
  const payload = await getFormat(school, formatName);
  const format = { ...payload, ...formatOverrides };
  const substitutionsPayload = buildSubstitutionsPayload(formatName, school, date, hideCancelCausedByEvent, format);
  return {
    substitutions: await getSubstitutionsWithPayload(school, substitutionsPayload),
    format,
  };
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

const convertNumberToDate = (number: number | null) => {
  if (number === null) return null;

  const date = number.toString();
  return new Date(
    Date.UTC(
      Number.parseInt(date.substring(0, 4), 10),
      Number.parseInt(date.substring(4, 6), 10) - 1,
      Number.parseInt(date.substring(6, 8), 10),
    ),
  );
};

const responseSchema = z.strictObject({
  payload: z.object({
    importInProgress: z.boolean(),
    date: z.number().nullable().transform(convertNumberToDate),
    nextDate: z.number().nullable().transform(convertNumberToDate),
    showingNextDate: z.boolean(),
    rows: z.array(
      z.union([
        z.object({
          data: z.array(z.string()),
          cssClasses: z.array(z.string()),
          cellClasses: z.object({}),
          group: z.string().nullable(),
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
    lastUpdate: z.string().transform((date) => dayjs(date, "DD.MM.YYYY HH:mm:ss").format()),
    absentElements: z.array(z.unknown()),
    affectedElements: z.object({ 1: z.array(z.string()).optional() }),
    messageData: z.object({
      messages: z.array(z.object({ subject: z.string(), body: z.string() })),
    }),
    weekDay: z.string(),
    regularFreeData: z.array(z.unknown()).length(0).nullable(),
  }),
});

export type KadmosSubstitutions = z.infer<typeof responseSchema>["payload"];
