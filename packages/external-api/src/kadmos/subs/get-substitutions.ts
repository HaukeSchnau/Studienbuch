import { parse } from "node-html-parser";
import { convertKadmosRowsToSubstitutionsTable, getSubstituionTableColumns } from "./convert-substitutions";
import { getSubstitutionsFromKadmos } from "./http";

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
    hideAbsent: false,
    showMessages: true,
  });

  const columns = getSubstituionTableColumns(format);
  const substitutions = convertKadmosRowsToSubstitutionsTable(rows, columns);

  const withParsedSubstitutions = substitutions.map((substitution) => {
    if (!substitution.teacher) return substitution;

    const html = parse(substitution.teacher);

    const substituteElem = html.querySelector(".substMonitorSubstElem");
    const teacherElem = html.querySelector(".cancelStyle");

    if (substituteElem && teacherElem) {
      const substitute = substituteElem.text;
      const teacher = teacherElem.text;
      return {
        ...substitution,
        substitute: ["---", ""].includes(substitute) ? undefined : substitute,
        teacher,
      };
    }

    return substitution;
  });

  return { columns, substitutions: withParsedSubstitutions, date, lastUpdate };
};
