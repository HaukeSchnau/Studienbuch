import clsx from "clsx";

import type { Issue, WorkflowState } from "@schnau/lib/src/tickets/getTickets";
import { formatDateRelative } from "@schnau/lib/src/date";
import {
  getStates,
  getTicketsForState,
} from "@schnau/lib/src/tickets/getTickets";

import style from "./roadmap.module.css";

export default async function RoadmapPage() {
  const states = await getStates();

  return (
    <div className="mx-12 py-12 md:mx-[10vw] md:py-16">
      <h1 className="text-primary-800 text-4xl font-bold">
        Woran wird gerade gearbeitet?
      </h1>

      <div className={clsx(style.stateColumns, "pt-10")}>
        {states.map((state, idx) => (
          <StateColumn
            key={state.id}
            state={state}
            isLast={idx === states.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

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
        "border-black-20 flex flex-col gap-4",
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

  return (
    <div
      className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-md"
      style={{ backgroundColor: color }}
    >
      {project && (
        <span className="text-sm italic opacity-80">{project.name}</span>
      )}
      {title}
      {description && (
        <p className="text-sm opacity-80">{description.slice(0, 100)}...</p>
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
