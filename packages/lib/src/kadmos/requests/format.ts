import { z } from "zod";

import { BASE_URL } from "./constants";

const buildFormatUrl = (school: string) =>
  `${BASE_URL}/substitution/format?school=${school}`;

export const getFormat = async (
  schoolName: string,
  formatName: string,
): Promise<KadmosFormat> => {
  const url = buildFormatUrl(schoolName);
  const payload = {
    formatName,
    schoolName,
  };

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
  });
  const json = await response.json();
  return schema.parse(json).payload;
};

const schema = z.strictObject({
  payload: z.object({
    customTitle: z.string(),
    dateOffset: z.number(),
    departmentIds: z.array(z.unknown()).length(0),
    departmentElementType: z.number(),
    fontSize: z.number(),
    groupBy: z.number(),
    height: z.number(),
    hideCancelWithSubstitution: z.boolean(),
    mergeBlocks: z.boolean(),
    numberOfDays: z.number(),
    pollingInterval: z.number(),
    scrollType: z.string(),
    scrollingInterval: z.number(),
    scrollSpeed: z.number(),
    showAbsentElements: z.array(z.number()),
    showAffectedElements: z.array(z.number()),
    showBreakSupervisions: z.boolean(),
    showClass: z.boolean(),
    showHour: z.boolean(),
    showInfo: z.boolean(),
    showMessages: z.boolean(),
    showOnlyFutureSub: z.boolean(),
    showRoom: z.boolean(),
    showSubject: z.boolean(),
    showSubstText: z.boolean(),
    showTeacher: z.boolean(),
    showTicker: z.boolean(),
    showTime: z.boolean(),
    strikethrough: z.boolean(),
    tickerFontSize: z.number(),
    hideAbsent: z.boolean(),
    rowHeaderEvenBackColor: z.string(),
    rowHeaderOddBackColor: z.string(),
    headerTitleForeColor: z.string(),
    headerTitleBackColor: z.string(),
    oddGroupBackColor: z.string(),
    evenGroupBackColor: z.string(),
    teacherLabelid: z.number(),
    enableSubstitutionFrom: z.boolean(),
    showSubstitutionFrom: z.number(),
    showUnitTime: z.boolean(),
    showStudentgroup: z.boolean(),
    showTeacherOnEvent: z.boolean(),
    activityTypeIds: z.array(z.number()),
    showEvent: z.boolean(),
    showCancel: z.boolean(),
    showOnlyCancel: z.boolean(),
    showWithoutElem: z.boolean(),
    showSubstTypeColor: z.boolean(),
    mergeRegularFree: z.boolean(),
    showAbsentTeacher: z.boolean(),
    strikethroughAbsentTeacher: z.boolean(),
    showExamSupervision: z.boolean(),
    showUnheraldedExams: z.boolean(),
  }),
});

export type KadmosFormat = z.infer<typeof schema>["payload"];
