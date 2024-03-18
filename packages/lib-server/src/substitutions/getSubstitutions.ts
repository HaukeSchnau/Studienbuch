import { getSubstitutionsFromKadmos } from "@schnau/external-api";

import {
  convertKadmosRowsToSubstitutionsTable,
  getSubstituionTableColumns,
} from "./convertSubstitutions";

export const getSubstitutions = async (school: string, formatName: string) => {
  const {
    format,
    substitutions: { rows, date, lastUpdate },
  } = await getSubstitutionsFromKadmos(school, formatName, new Date(), false, {
    showTeacher: true,
    showAbsentTeacher: true,
    showRoom: true,
    showSubject: true,
    showClass: true,
    showStudentgroup: true,
    showTime: true,
    showSubstText: true,
    showInfo: true,
    showSubstTypeColor: true,
    showHour: true,
    showBreakSupervisions: true,
    showExamSupervision: true,
    showUnitTime: true,
    showCancel: true,
    showEvent: true,
    showTeacherOnEvent: true,
    showUnheraldedExams: true,
    enableSubstitutionFrom: true,
    hideAbsent: false,
    showMessages: true,
  });

  const columns = getSubstituionTableColumns(format);
  const substitutions = convertKadmosRowsToSubstitutionsTable(rows, columns);

  return { columns, substitutions, date, lastUpdate };
};
