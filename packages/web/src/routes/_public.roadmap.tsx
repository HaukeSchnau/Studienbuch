import { formatDateRelative } from "@stu/lib";
import { getStates, getTicketsForState } from "@stu/lib-server";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn, useServerFn } from "@tanstack/react-start";
import clsx from "clsx";

import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import style from "~/legacy-next-app/app/(public)/roadmap/roadmap.module.css";

const getRoadmapDataFn = createServerFn({ method: "GET" }).handler(async () => {
  const states = await getStates();

  return Promise.all(
    states.map(async (state) => {
      const issues = await getTicketsForState(state.id);
      issues.sort((a, b) => a.priority - b.priority);

      const normalizedIssues = await Promise.all(
        issues.map(async (issue) => {
          const project = await issue.project;
          const labels = (await issue.labels()).nodes;

          return {
            id: issue.id,
            title: issue.title,
            description: issue.description,
            updatedAt: issue.updatedAt,
            project: project ? { name: project.name } : null,
            labels: labels.map((label) => ({
              id: label.id,
              name: label.name,
              color: label.color,
            })),
          };
        }),
      );

      return {
        id: state.id,
        name: state.name,
        color: state.color,
        issues: normalizedIssues,
      };
    }),
  );
});

export const Route = createFileRoute("/_public/roadmap")({
  component: RoadmapPage,
});

function RoadmapPage() {
  const getRoadmapData = useServerFn(getRoadmapDataFn);
  const { data: states, isPending } = useSuspenseQuery({
    queryKey: ["roadmap", "states"],
    queryFn: () => getRoadmapData(),
  });

  if (isPending) {
    return (
      <div className="grid h-96 place-items-center">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="py-12 md:py-16">
      <h1 className="px-12 text-4xl font-bold text-primary-text md:px-[10vw]">Woran wird gerade gearbeitet?</h1>

      <div className={clsx(style.stateColumns, "px-12 pt-10 md:px-[10vw]")}>
        {states.map((state, idx) => (
          <div
            key={state.id}
            className={clsx("flex flex-col gap-4 border-black-20", idx < states.length - 1 && "mr-4 border-r pr-4")}
          >
            <h2 className="pl-4 font-medium">{state.name}</h2>
            <div className="flex flex-col gap-4">
              {state.issues.map((issue) => (
                <div
                  key={issue.id}
                  className={clsx("flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-md", style.issueCard)}
                  style={{ backgroundColor: state.color }}
                >
                  {issue.project && <span className="text-sm italic opacity-80">{issue.project.name}</span>}
                  {issue.title}

                  {issue.description && (
                    <div className="min-h-4">
                      <div className={style.descriptionExpander}>
                        <div className={clsx("flex flex-col gap-2 text-sm opacity-80", style.description)}>
                          {issue.description.split("\n\n").map((paragraph, idx) => (
                            // oxlint-disable-next-line react/no-array-index-key
                            <p key={idx}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                      <div
                        className={clsx(
                          "h-4 w-min rounded-full bg-black-20 px-2 leading-none transition-all",
                          style.moreTextIndicator,
                        )}
                      >
                        ⋯
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {issue.labels.map((label) => (
                        <span
                          key={label.id}
                          className="rounded-lg px-2 py-1 text-xs text-white"
                          style={{ backgroundColor: label.color }}
                        >
                          {label.name}
                        </span>
                      ))}
                    </div>

                    <div className="text-xs opacity-80">{formatDateRelative(issue.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
