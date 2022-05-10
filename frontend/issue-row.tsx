import React from "react";
import type { Issue, Priority, Status } from "./issue";
import { formatDate } from "../util/date";
import PriorityMenu from "./priority-menu";
import StatusMenu from "./status-menu";
import { useQueryState } from "next-usequerystate";

interface Props {
  issue: Issue;
  onChangePriority?: (issue: Issue, priority: Priority) => void;
  onChangeStatus?: (issue: Issue, status: Status) => void;
}

function IssueRow({ issue, onChangePriority, onChangeStatus }: Props) {
  const [, setDetailIssueID] = useQueryState("iss", {
    history: "push",
  });
  const handleChangePriority = (p: Priority) => {
    if (onChangePriority) onChangePriority(issue, p);
  };

  const handleChangeStatus = (status: Status) => {
    if (onChangeStatus) onChangeStatus(issue, status);
  };

  const handleIssueRowClick = async () => {
    await setDetailIssueID(issue.id, {
      scroll: false,
      shallow: true,
    });
  };

  return (
    <div
      className="inline-flex items-center flex-grow flex-shrink w-full min-w-0 pl-2 pr-4 lg:pr-8 text-sm border-b border-gray-850 hover:bg-gray-850 hover:bg-opacity-40 h-11 cursor-pointer text-white border-y-1"
      id={issue.id}
      onClick={handleIssueRowClick}
    >
      <div className="flex-shrink-0 ml-2">
        <PriorityMenu
          labelVisible={false}
          onSelect={handleChangePriority}
          priority={issue.priority}
        />
      </div>
      <div className="flex-shrink-0 ml-1">
        <StatusMenu onSelect={handleChangeStatus} status={issue.status} />
      </div>
      <div className="flex-wrap flex-shrink-1 flex-grow ml-2 overflow-hidden font-medium line-clamp-1 overflow-ellipsis">
        {issue.title.substr(0, 3000) || ""}
      </div>
      <div className="flex-shrink-0 ml-2 font-normal sm:block">
        {formatDate(new Date(issue.modified))}
      </div>
    </div>
  );
}

export default React.memo(IssueRow);
