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
  statuses: Set<Status>
) {
  for (const s of statuses) {
    if (!viewStatuses.has(s)) {
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
): null | ((issue: Issue) => boolean) {
  if (priorities.size === 0) {
    return null;
  }
  return (issue) => priorities.has(issue.priority);
}

export function getStatusFilter(
  viewStatuses: Set<Status>,
  statuses: Set<Status>
): null | ((issue: Issue) => boolean) {
  const allStatuses = new Set<Status>([...viewStatuses, ...statuses]);
  if (allStatuses.size === 0) {
    return null;
  }
  return (issue) => allStatuses.has(issue.status);
}

export function getCreatorFilter(
  creators: Set<string>
): null | ((issue: Issue) => boolean) {
  if (creators.size === 0) {
    return null;
  }
  return (issue) => creators.has(issue.creator.toLowerCase());
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

export function getCreators(creatorFilter: string | null): Set<string> {
  const creators = new Set<string>();
  if (!creatorFilter) {
    return creators;
  }

  for (const c of creatorFilter.split(",")) {
    creators.add(c.toLowerCase());
  }

  return creators;
}

export function getTitleFilter(title: string): (issue: Issue) => boolean {
  return (issue) => issue.title.toLowerCase().includes(title.toLowerCase());
}
