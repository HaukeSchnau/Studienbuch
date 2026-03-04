import { defaultSchools, SCHOOL_IDS } from "@stu/lib";
import { addRowSpans, getSubstitutions } from "@stu/lib-server";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { z } from "zod";

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

const getSubstitutionsForSchoolFn = createServerFn({ method: "GET" })
  .inputValidator(z.object({ school: z.enum(SCHOOL_IDS) }))
  .handler(async ({ data }) => {
    const schoolName = defaultSchools[data.school]?.name ?? data.school;
    const formatName = "iServ_SuS_heute";

    const {
      columns,
      substitutions: substitutionsWithoutRowSpan,
      date,
      lastUpdate,
    } = await getSubstitutions(schoolName, formatName);
    const substitutions = addRowSpans(substitutionsWithoutRowSpan);

    substitutions.sort((a, b) => {
      return (
        optionalCompare(a.time?.data, b.time?.data) ||
        optionalCompare(a.class?.data, b.class?.data) ||
        optionalCompare(a.subject?.data, b.subject?.data)
      );
    });

    for (let i = substitutions.length - 1; i > 0; i--) {
      // oxlint-disable-next-line @typescripttypescript/no-non-null-assertion
      const current = substitutions[i]!;
      // oxlint-disable-next-line @typescripttypescript/no-non-null-assertion
      const previous = substitutions[i - 1]!;

      if (previous.time && current.time && current.time.data === previous.time.data) {
        previous.time.rowSpan = current.time.rowSpan + previous.time.rowSpan;
        current.time = undefined;
      }

      if (previous.hour && current.hour && current.hour.data === previous.hour.data) {
        previous.hour.rowSpan = current.hour.rowSpan + previous.hour.rowSpan;
        current.hour = undefined;
      }
    }

    return {
      schoolName,
      columns,
      substitutions,
      date,
      lastUpdate,
    };
  });

export const Route = createFileRoute("/admin/schools/$school/substitutions")({
  component: SubstitutionPage,
});

function SubstitutionPage() {
  const params = Route.useParams();
  const school = z.enum(SCHOOL_IDS).parse(params.school);
  const getSubstitutionsForSchool = useServerFn(getSubstitutionsForSchoolFn);
  const { data, isPending, error } = useQuery({
    queryKey: ["schools", "substitutions", school],
    queryFn: () => getSubstitutionsForSchool({ data: { school } }),
  });

  if (isPending) {
    return <div>Lädt...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  if (!data) {
    return null;
  }

  return (
    <>
      <PageHeading color="white">
        Vertretungsplan für {data.schoolName} am {dayjs(data.date).format("DD.MM.YYYY")}
      </PageHeading>
      <div className="pb-4 text-white">Stand: {dayjs(data.lastUpdate).format("DD.MM.YYYY HH:mm")}</div>

      <Card noPadding className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th className="border-l border-grey-100 py-4 font-normal" key={column.key}>
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.substitutions.map((row, i) => (
              <tr key={i}>
                {data.columns.map(
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

      <div className="h-16" />

      <Card noPadding className="overflow-x-auto">
        <DBSubstitutionTable />
      </Card>
    </>
  );
}

const DBSubstitutionTable = () => {
  return <></>;
};
