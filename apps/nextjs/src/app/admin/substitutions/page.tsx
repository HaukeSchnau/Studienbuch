import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

import {
  convertKadmosRowsToSubstitutionsTable,
  getSubstituionTableColumns,
} from "@schnau/lib/src/substitutions/kadmos/convertSubstitutions";
import { getSubstitutionsFromKadmos } from "@schnau/lib/src/substitutions/kadmos/requests/substitutions";

import { Card } from "~/components/layout/Card";
import { PageHeading } from "~/components/layout/PageHeading";

dayjs.extend(customParseFormat);

const optionalCompare = (a: string | undefined, b: string | undefined) => {
  if (a === b) {
    return 0;
  }
  if (a === undefined) {
    return 1;
  }
  if (b === undefined) {
    return -1;
  }
  return a.localeCompare(b);
};

export default async function SubstitutionPage() {
  const school = "IGS Lilienthal";
  const FORMAT_NAME = "iServ_SuS_heute";

  const {
    format,
    substitutions: { rows, date, lastUpdate },
  } = await getSubstitutionsFromKadmos(school, FORMAT_NAME, new Date(), false, {
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
  const rowsWithColumns = convertKadmosRowsToSubstitutionsTable(rows, columns);

  rowsWithColumns.sort((a, b) => {
    return (
      optionalCompare(a.time?.data, b.time?.data) ||
      optionalCompare(a.class?.data, b.class?.data) ||
      optionalCompare(a.subject?.data, b.subject?.data)
    );
  });

  for (let i = rowsWithColumns.length - 1; i > 0; i--) {
    const current = rowsWithColumns[i]!;
    const previous = rowsWithColumns[i - 1]!;
    if (
      previous.time &&
      current.time &&
      current.time.data === previous.time.data
    ) {
      previous.time.rowSpan = current.time.rowSpan + previous.time.rowSpan;
      current.time = undefined;
    }

    if (
      previous.hour &&
      current.hour &&
      current.hour.data === previous.hour.data
    ) {
      previous.hour.rowSpan = current.hour.rowSpan + previous.hour.rowSpan;
      current.hour = undefined;
    }
  }

  return (
    <>
      <PageHeading color="white">
        Vertretungsplan für {school} am {dayjs(date).format("DD.MM.YYYY")}
      </PageHeading>
      <div className="pb-4 text-white">
        Stand: {dayjs(lastUpdate).format("DD.MM.YYYY HH:mm")}
      </div>

      <Card noPadding className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  className="border-l border-grey-100 py-4 font-normal"
                  key={column.key}
                >
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsWithColumns.map((row, i) => (
              <tr key={i}>
                {columns.map(
                  (column) =>
                    row[column.key] && (
                      <td
                        className="border-l border-t border-grey-100 px-2 py-1"
                        key={column.key}
                        rowSpan={row[column.key]?.rowSpan}
                      >
                        {row[column.key]?.data}
                      </td>
                    ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
