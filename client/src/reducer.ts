import {Issue, Order} from 'shared';
import {
  priorityOrderValues,
  reverseTimestampSortKey,
  statusOrderValues,
} from './issue/issue';
import {PersistentTreeView} from '@vlcn.io/materialite';

export type IssueViews = {
  filteredIssues: PersistentTreeView<Issue>['value'];
  issueCount: number;
  hasNonViewFilters: boolean;
  // minKanban: Issue;
};

export function getOrderValue(issueOrder: Order, issue: Issue): string {
  let orderValue: string;
  switch (issueOrder) {
    case 'CREATED':
      orderValue = reverseTimestampSortKey(issue.created, issue.id);
      break;
    case 'MODIFIED':
      orderValue = reverseTimestampSortKey(issue.modified, issue.id);
      break;
    case 'STATUS':
      orderValue =
        statusOrderValues[issue.status] +
        '-' +
        reverseTimestampSortKey(issue.modified, issue.id);
      break;
    case 'PRIORITY':
      orderValue =
        priorityOrderValues[issue.priority] +
        '-' +
        reverseTimestampSortKey(issue.modified, issue.id);
      break;
    case 'KANBAN':
      orderValue = issue.kanbanOrder + '-' + issue.id;
      break;
  }
  return orderValue;
}
