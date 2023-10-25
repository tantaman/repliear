import {
  Priority,
  Issue,
  priorityEnumSchema,
  Status,
  statusEnumSchema,
} from "./issue";

type Comparison = ">=" | "<=";

export function hasNonViewFilters(
  viewStatuses: Set<string>,
  statuses: Set<string>
) {
  for (const s of statuses) {
    if (!viewStatuses?.has(s)) {
      return true;
    }
  }

  return false;
}

export function getViewStatuses(view: string | null): Set<Status> {
  switch (view?.toLowerCase()) {
    case "active":
      return new Set([Status.IN_PROGRESS, Status.TODO]);
    case "backlog":
      return new Set([Status.BACKLOG]);
    default:
      return new Set();
  }
}

export function getStatuses(statusFilter: string | null): Set<Status> {
  const statuses = new Set<Status>();
  if (!statusFilter) {
    return statuses;
  }

  for (const s of statusFilter.split(",")) {
    const parseResult = statusEnumSchema.safeParse(s);
    if (parseResult.success) {
      statuses.add(parseResult.data);
    }
  }

  return statuses;
}

export function getPriorities(priorityFilter: string | null): Set<Priority> {
  const priorities = new Set<Priority>();
  if (!priorityFilter) {
    return priorities;
  }
  for (const p of priorityFilter.split(",")) {
    const parseResult = priorityEnumSchema.safeParse(p);
    if (parseResult.success) {
      priorities.add(parseResult.data);
    }
  }

  return priorities;
}

export function getPriorityFilter(
  priorities: Set<Priority>
): (issue: Issue) => boolean {
  return (issue) =>
    priorities.size === 0 ? true : priorities.has(issue.priority);
}

export function getStatusFilter(
  viewStatuses: Set<Status>,
  statuses: Set<Status>
): (issue: Issue) => boolean {
  const allStatuses = new Set<Status>([...viewStatuses, ...statuses]);
  return (issue) =>
    allStatuses.size === 0 ? true : allStatuses.has(issue.status);
}

export function getViewFilter(
  viewStatuses: Set<Status>
): (issue: Issue) => boolean {
  return (issue) =>
    viewStatuses.size === 0 ? true : viewStatuses.has(issue.status);
}

export function getModifiedFilter(
  time: number,
  op: Comparison
): (issue: Issue) => boolean {
  return (issue) =>
    op === "<=" ? issue.modified <= time : issue.modified >= time;
}

export function getCreatedFilter(
  time: number,
  op: Comparison
): (issue: Issue) => boolean {
  return (issue) =>
    op === "<=" ? issue.created <= time : issue.created >= time;
}

export function getCreatorFilter(creator: string): (issue: Issue) => boolean {
  return (issue) => issue.creator.toLowerCase() === creator.toLowerCase();
}

export function getTitleFilter(title: string): (issue: Issue) => boolean {
  return (issue) => issue.title.toLowerCase().includes(title.toLowerCase());
}
