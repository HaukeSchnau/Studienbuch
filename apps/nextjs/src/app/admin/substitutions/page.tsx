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
                {columns.map((column) => (
                  <td
                    className="border-l border-t border-grey-100 px-2 py-1"
                    key={column.key}
                  >
                    {row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
