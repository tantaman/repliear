import { PersistentTreap, PersistentTreeView } from "@vlcn.io/materialite";
import { generateNKeysBetween } from "fractional-indexing";
import React, { memo, useCallback, useEffect, useState } from "react";
import { DragDropContext, DropResult } from "react-beautiful-dnd";

import {
  Status,
  Issue,
  IssueUpdate,
  Priority,
  StatusUnion,
  statuses,
} from "./issue";
import IssueCol from "./issue-col";

export type IssuesByStatusType = Record<
  StatusUnion,
  PersistentTreeView<Issue>["data"]
>;

const defaultIssuesByType = {
  [Status.BACKLOG]: PersistentTreap.empty(),
  [Status.TODO]: PersistentTreap.empty(),
  [Status.IN_PROGRESS]: PersistentTreap.empty(),
  [Status.DONE]: PersistentTreap.empty(),
  [Status.CANCELED]: PersistentTreap.empty(),
};

const kanbanComparator = (l: Issue, r: Issue) => {
  const comp =
    l.kanbanOrder < r.kanbanOrder ? -1 : l.kanbanOrder > r.kanbanOrder ? 1 : 0;
  if (comp === 0) {
    return l.id.localeCompare(r.id);
  }
  return comp;
};

export function getKanbanOrderIssueUpdates(
  issueToMove: Issue,
  issueToInsertBefore: Issue,
  issues: PersistentTreeView<Issue>["data"]
): IssueUpdate[] {
  const indexInKanbanOrder = issues.findIndex(
    (issue: Issue) => issue.id === issueToInsertBefore.id
  );

  let beforeKey: string | null = null;
  if (indexInKanbanOrder > 0) {
    beforeKey = issues.at(indexInKanbanOrder - 1).kanbanOrder;
  }
  let afterKey: string | null = null;
  const issuesToReKey: Issue[] = [];
  // If the issues we are trying to move between
  // have identical kanbanOrder values, we need to fix up the
  // collision by re-keying the issues.
  for (let i = indexInKanbanOrder; i < issues.length; i++) {
    if (issues.at(i).kanbanOrder !== beforeKey) {
      afterKey = issues.at(i).kanbanOrder;
      break;
    }
    issuesToReKey.push(issues.at(i));
  }
  const newKanbanOrderKeys = generateNKeysBetween(
    beforeKey,
    afterKey,
    issuesToReKey.length + 1 // +1 for the dragged issue
  );

  const issueUpdates = [
    {
      issue: issueToMove,
      issueChanges: { kanbanOrder: newKanbanOrderKeys[0] },
    },
  ];
  for (let i = 0; i < issuesToReKey.length; i++) {
    issueUpdates.push({
      issue: issuesToReKey[i],
      issueChanges: { kanbanOrder: newKanbanOrderKeys[i + 1] },
    });
  }
  return issueUpdates;
}

interface Props {
  issues: PersistentTreeView<Issue>;
  onUpdateIssues: (issueUpdates: IssueUpdate[]) => void;
  onOpenDetail: (issue: Issue) => void;
}

function IssueBoard({ issues, onUpdateIssues, onOpenDetail }: Props) {
  const [issuesByType, setIssuesByType] = useState<IssuesByStatusType>(
    defaultIssuesByType
  );

  useEffect(() => {
    const views: PersistentTreeView<Issue>[] = [];
    for (const status of statuses) {
      // TODO (mlaw): add a `split` operator to materialite.
      // The idea there would be to split a stream by key into many streams.
      const view = issues.stream
        .filter((issue) => issue.status === status)
        .materialize(kanbanComparator);
      views.push(view);
      view.onChange((data) => {
        console.log("RECEIVED CHANGE " + data.size);
        setIssuesByType((issuesByType) => ({
          ...issuesByType,
          [status]: data,
        }));
      });
    }
    return () => {
      views.forEach((v) => v.destroy());
    };
  }, [issues]);

  const handleDragEnd = useCallback(
    ({ source, destination }: DropResult) => {
      if (!destination) {
        return;
      }
      const sourceStatus = source?.droppableId as Status;
      const draggedIssue = issuesByType[sourceStatus][source.index];
      if (!draggedIssue) {
        return;
      }
      const newStatus = destination.droppableId as Status;
      const newIndex =
        sourceStatus === newStatus && source.index < destination.index
          ? destination.index + 1
          : destination.index;
      const issueToInsertBefore = issuesByType[newStatus][newIndex];
      if (draggedIssue === issueToInsertBefore) {
        return;
      }
      const issueUpdates = issueToInsertBefore
        ? getKanbanOrderIssueUpdates(
            draggedIssue,
            issueToInsertBefore,
            issuesByType[newStatus]
          )
        : [{ issue: draggedIssue, issueChanges: {} }];
      if (newStatus !== sourceStatus) {
        issueUpdates[0] = {
          ...issueUpdates[0],
          issueChanges: {
            ...issueUpdates[0].issueChanges,
            status: newStatus,
          },
        };
      }
      onUpdateIssues(issueUpdates);
    },
    [issuesByType, onUpdateIssues]
  );

  const handleChangePriority = useCallback(
    (issue: Issue, priority: Priority) => {
      onUpdateIssues([
        {
          issue,
          issueChanges: { priority },
        },
      ]);
    },
    [onUpdateIssues]
  );

  console.log(issuesByType);
  console.log("BACKLOG " + issuesByType[Status.BACKLOG].size);
  console.log("CANCELED " + issuesByType[Status.CANCELED].size);
  console.log("IN_PROGRESS " + issuesByType[Status.IN_PROGRESS].size);
  console.log("DONE " + issuesByType[Status.DONE].size);
  console.log("TODO " + issuesByType[Status.TODO].size);

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-1 pt-6 pl-8 overflow-scroll-x bg-gray border-color-gray-50 border-right-width-1">
        <IssueCol
          title={"Backlog"}
          status={Status.BACKLOG}
          issues={issuesByType[Status.BACKLOG]}
          onChangePriority={handleChangePriority}
          onOpenDetail={onOpenDetail}
        />
        <IssueCol
          title={"Todo"}
          status={Status.TODO}
          issues={issuesByType[Status.TODO]}
          onChangePriority={handleChangePriority}
          onOpenDetail={onOpenDetail}
        />
        <IssueCol
          title={"In Progress"}
          status={Status.IN_PROGRESS}
          issues={issuesByType[Status.IN_PROGRESS]}
          onChangePriority={handleChangePriority}
          onOpenDetail={onOpenDetail}
        />
        <IssueCol
          title={"Done"}
          status={Status.DONE}
          issues={issuesByType[Status.DONE]}
          onChangePriority={handleChangePriority}
          onOpenDetail={onOpenDetail}
        />
        <IssueCol
          title={"Canceled"}
          status={Status.CANCELED}
          issues={issuesByType[Status.CANCELED]}
          onChangePriority={handleChangePriority}
          onOpenDetail={onOpenDetail}
        />
      </div>
    </DragDropContext>
  );
}

export default memo(IssueBoard);
