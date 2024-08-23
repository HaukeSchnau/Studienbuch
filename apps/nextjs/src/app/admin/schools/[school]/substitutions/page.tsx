import { desc } from "@stu/db";
import { db } from "@stu/db/client";
import { Substitution } from "@stu/db/schema";
import { formalName } from "@stu/lib";
import { addRowSpans, getSubstitutions } from "@stu/lib-server";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

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
    columns,
    substitutions: substitutionsWithoutRowSpan,
    date,
    lastUpdate,
  } = await getSubstitutions(school, FORMAT_NAME);
  const substitutions = addRowSpans(substitutionsWithoutRowSpan);

  substitutions.sort((a, b) => {
    return (
      optionalCompare(a.time?.data, b.time?.data) ||
      optionalCompare(a.class?.data, b.class?.data) ||
      optionalCompare(a.subject?.data, b.subject?.data)
    );
  });

  for (let i = substitutions.length - 1; i > 0; i--) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const current = substitutions[i]!;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const previous = substitutions[i - 1]!;
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
            {substitutions.map((row, i) => (
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

      <div className="h-16"></div>

      <Card noPadding className="overflow-x-auto">
        <DBSubstitutionTable />
      </Card>
    </>
  );
}

const DBSubstitutionTable = async () => {
  const substitutions = await db.query.Substitution.findMany({
    with: {
      substitute: true,
      course: {
        with: {
          teacher: true,
          classesToCourses: {
            with: {
              class: {
                with: {
                  year: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: desc(Substitution.date),
    limit: 100,
  });

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="border-l border-grey-100 py-4 font-normal">Datum</th>
          <th className="border-l border-grey-100 py-4 font-normal">Lehrer</th>
          <th className="border-l border-grey-100 py-4 font-normal">
            Vertreter
          </th>
          <th className="border-l border-grey-100 py-4 font-normal">Fach</th>
          <th className="border-l border-grey-100 py-4 font-normal">Kurs</th>
          <th className="border-l border-grey-100 py-4 font-normal">
            Jahrgang
          </th>
          <th className="border-l border-grey-100 py-4 font-normal">Raum</th>
          <th className="border-l border-grey-100 py-4 font-normal">Art</th>
        </tr>
      </thead>
      <tbody>
        {substitutions.map((substitution, i) => (
          <tr key={i}>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {dayjs(substitution.date).format("DD.MM.YYYY")}
            </td>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {formalName(substitution.course.teacher)}
            </td>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {substitution.substitute
                ? formalName(substitution.substitute)
                : ""}
            </td>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {substitution.course.name}
            </td>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {substitution.course.courseId}
            </td>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {substitution.course.classesToCourses
                .map(({ class: clazz }) => clazz.year.name)
                .join(", ")}
            </td>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {substitution.room}
            </td>
            <td className="border-l border-t border-grey-100 px-2 py-1">
              {substitution.type}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
