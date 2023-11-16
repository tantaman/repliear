import useQueryState, {
  identityProcessor,
  QueryStateProcessor,
} from './useQueryState';
import {Order, Priority, Status} from 'shared';
import {DateQueryArg} from '../filters';

const processOrderBy: QueryStateProcessor<Order> = {
  toString: (value: Order) => value,
  fromString: (value: string | null) => (value ?? 'MODIFIED') as Order,
};

const processStatuFilter: QueryStateProcessor<Status[]> = {
  toString: (value: Status[]) => value.join(','),
  fromString: (value: string | null) =>
    value === null ? null : (value.split(',') as Status[]),
};

const processPriorityFilter: QueryStateProcessor<Priority[]> = {
  toString: (value: Priority[]) => value.join(','),
  fromString: (value: string | null) =>
    value === null ? null : (value.split(',') as Priority[]),
};

const processCreatorFilter: QueryStateProcessor<string[]> = {
  toString: (value: string[]) => value.join(','),
  fromString: (value: string | null) =>
    value === null ? null : value.split(','),
};

const processDateFilter: QueryStateProcessor<DateQueryArg[]> = {
  toString: (value: DateQueryArg[]) => value.join(','),
  fromString: (value: string | null) =>
    value === null ? null : (value.split(',') as DateQueryArg[]),
};

export function useOrderByState() {
  return useQueryState('orderBy', processOrderBy);
}

export function useStatusFilterState() {
  return useQueryState('statusFilter', processStatuFilter);
}

export function usePriorityFilterState() {
  return useQueryState('priorityFilter', processPriorityFilter);
}

export function useViewState() {
  return useQueryState('view', identityProcessor);
}

export function useIssueDetailState() {
  return useQueryState('iss', identityProcessor);
}

export function useCreatorFilterState() {
  return useQueryState('creatorFilter', processCreatorFilter);
}

export function useCreatedFilterState() {
  return useQueryState('createdFilter', processDateFilter);
}

export function useModifiedFilterState() {
  return useQueryState('modifiedFilter', processDateFilter);
}
