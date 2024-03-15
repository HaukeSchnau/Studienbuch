import { Fragment, Suspense } from "react";
import clsx from "clsx";

import type { Issue, WorkflowState } from "@schnau/lib/src/tickets/getTickets";
import { formatDateRelative } from "@schnau/lib/src/date";
import {
  getStates,
  getTicketsForState,
} from "@schnau/lib/src/tickets/getTickets";

import { LoadingIndicator } from "~/components/layout/LoadingIndicator";
import style from "./roadmap.module.css";

export const revalidate = 30;

export default async function RoadmapPage() {
  return (
    <div className=" py-12  md:py-16">
      <h1 className="px-12 text-4xl font-bold text-primary-800 md:px-[10vw]">
        Woran wird gerade gearbeitet?
      </h1>

      <Suspense
        fallback={
          <div className="grid h-96 place-items-center">
            <LoadingIndicator />
          </div>
        }
      >
        <StateColumns />
      </Suspense>
    </div>
  );
}

const StateColumns = async () => {
  const states = await getStates();

  return (
    <div className={clsx(style.stateColumns, "px-12 pt-10 md:px-[10vw]")}>
      {states.map((state, idx) => (
        <StateColumn
          key={state.id}
          state={state}
          isLast={idx === states.length - 1}
        />
      ))}
    </div>
  );
};

interface StateColumnProps {
  state: WorkflowState;
  isLast: boolean;
}

const StateColumn = async ({ state, isLast }: StateColumnProps) => {
  const issues = await getTicketsForState(state.id);
  issues.sort((a, b) => a.priority - b.priority);

  return (
    <div
      className={clsx(
        "flex flex-col gap-4 border-black-20",
        !isLast && "mr-4 border-r pr-4",
      )}
    >
      <h2 className="pl-4 font-medium">{state.name}</h2>
      <div className="flex flex-col gap-4">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} color={state.color} />
        ))}
      </div>
    </div>
  );
};

interface IssueCardProps {
  issue: Issue;
  color: string;
}

const IssueCard = async ({ issue, color }: IssueCardProps) => {
  const project = await issue.project;
  const labels = (await issue.labels()).nodes;

  const { title, description } = issue;

  const canExpand = !!description;

  return (
    <div
      className={clsx(
        "flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-md",
        style.issueCard,
      )}
      style={{ backgroundColor: color }}
      tabIndex={canExpand ? 0 : undefined}
      role={canExpand ? "button" : undefined}
    >
      {project && (
        <span className="text-sm italic opacity-80">{project.name}</span>
      )}
      {title}
      {description && (
        <div className="min-h-4">
          <div className={style.descriptionExpander}>
            <div
              className={clsx(
                "flex flex-col gap-2 text-sm opacity-80",
                style.description,
              )}
            >
              <Paragraphs text={description} />
            </div>
          </div>
          <MoreTextIndicator className={style.moreTextIndicator} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        {labels.map((label) => (
          <span
            key={label.id}
            className="rounded-lg px-2 py-1 text-xs text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
          </span>
        ))}

        <div className="text-xs opacity-80">
          {formatDateRelative(issue.updatedAt)}
        </div>
      </div>
    </div>
  );
};

const MoreTextIndicator = ({ className }: { className?: string }) => {
  return (
    <div
      className={clsx(
        "h-4 w-min rounded-full bg-black-20 px-2 leading-none transition-all",
        className,
      )}
    >
      ⋯
    </div>
  );
};

const Paragraphs = ({ text }: { text: string }) => {
  const paragraphs = text.split("\n\n");

  return paragraphs.map((paragraph, idx) => (
    <p key={idx}>
      {paragraph.split("\n").map((line, idx) => (
        <Fragment key={idx}>
          {line}
          <br />
        </Fragment>
      ))}
    </p>
  ));
};
