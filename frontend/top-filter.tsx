import MenuIcon from "./assets/icons/menu.svg";
import React, { memo } from "react";

import SortOrderMenu from "./sort-order-menu";
import { queryTypes, useQueryState } from "next-usequerystate";
import FilterMenu from "./filter-menu";
import { Order, Priority, Status } from "./issue";
import { noop } from "lodash";
import type { DateQueryArg, Op } from "./filters";

interface Props {
  title: string;
  onToggleMenu?: (() => void) | undefined;
  filteredIssuesCount?: number | undefined;
  issuesCount: number;
  showSortOrderMenu: boolean;
}

interface FilterStatusProps {
  filter: Status[] | Priority[] | string[] | null;
  onDelete: () => void;
  label: string;
}

type DateFilterStatusProps = {
  filter: DateQueryArg[] | null;
  onDelete: () => void;
  label: string;
};

const displayStrings: Record<Priority | Status | string, string> = {
  [Priority.NONE]: "None",
  [Priority.LOW]: "Low",
  [Priority.MEDIUM]: "Medium",
  [Priority.HIGH]: "High",
  [Priority.URGENT]: "Urgent",

  [Status.BACKLOG]: "Backlog",
  [Status.TODO]: "Todo",
  [Status.IN_PROGRESS]: "In Progress",
  [Status.DONE]: "Done",
  [Status.CANCELED]: "Canceled",
};

const FilterStatus = ({ filter, onDelete, label }: FilterStatusProps) => {
  if (!filter || filter.length === 0) return null;
  return (
    <div className="flex items-center pr-4 space-x-[1px]">
      <span className="px-1 text-gray-50 bg-gray-850 rounded-l">
        {label} is
      </span>
      <span className="px-1 text-gray-50 bg-gray-850 ">
        {filter.map((f) => displayStrings[f] || f).join(", ")}
      </span>
      <span
        className="px-1 text-gray-50 bg-gray-850 rounded-r cursor-pointer"
        onMouseDown={onDelete}
      >
        &times;
      </span>
    </div>
  );
};

function DateFilterStatus({ filter, onDelete, label }: DateFilterStatusProps) {
  if (!filter || filter.length === 0) return null;
  return (
    <div className="flex items-center pr-4 space-x-[1px]">
      <span className="px-1 text-gray-50 bg-gray-850 rounded-l">
        {label} is
      </span>
      <span className="px-1 text-gray-50 bg-gray-850 ">
        {filter
          .map((f) => {
            const [time, op] = f.split("|") as [string, Op];
            return `${op} ${new Date(parseInt(time)).toLocaleDateString()}`;
          })
          .join(" AND ")}
      </span>
      <span
        className="px-1 text-gray-50 bg-gray-850 rounded-r cursor-pointer"
        onMouseDown={onDelete}
      >
        &times;
      </span>
    </div>
  );
}

const TopFilter = ({
  title,
  onToggleMenu = noop,
  filteredIssuesCount,
  issuesCount,
  showSortOrderMenu,
}: Props) => {
  const [orderBy, setOrderByParam] = useQueryState(
    "orderBy",
    queryTypes
      .stringEnum<Order>(Object.values(Order))
      .withDefault(Order.MODIFIED)
  );
  const [statusFilters, setStatusFilterByParam] = useQueryState(
    "statusFilter",
    queryTypes.array<Status>(
      queryTypes.stringEnum<Status>(Object.values(Status))
    )
  );
  const [priorityFilters, setPriorityFilterByParam] = useQueryState(
    "priorityFilter",
    queryTypes.array<Priority>(
      queryTypes.stringEnum<Priority>(Object.values(Priority))
    )
  );
  const [creatorFilters, setCreatorFilterByParam] = useQueryState(
    "creatorFilter",
    queryTypes.array<string>(queryTypes.string)
  );
  const [createdFilters, setCreatedFilterByParam] = useQueryState(
    "createdFilter",
    queryTypes.array<DateQueryArg>(queryTypes.string as any)
  );
  const [modifiedFilters, setModifiedFilterByParam] = useQueryState(
    "modifiedFilter",
    queryTypes.array<DateQueryArg>(queryTypes.string as any)
  );

  return (
    <>
      <div className="flex justify-between flex-shrink-0 pl-2 lg:pl-9 pr-2 lg:pr-6 border-b border-gray-850 h-14 border-b-color-gray-50">
        {/* left section */}
        <div className="flex items-center">
          <button
            className="flex-shrink-0 h-full px-5 focus:outline-none lg:hidden"
            onClick={onToggleMenu}
          >
            <MenuIcon className="w-3.5 text-white hover:text-gray-50" />
          </button>
          <div className="p-1 font-semibold cursor-default">{title}</div>
          {filteredIssuesCount ? (
            <span>
              {filteredIssuesCount} / {issuesCount}
            </span>
          ) : (
            <span>{issuesCount}</span>
          )}
          <FilterMenu
            onSelectPriority={createEnumSetFilterHandler(
              priorityFilters,
              setPriorityFilterByParam
            )}
            onSelectStatus={createEnumSetFilterHandler(
              statusFilters,
              setStatusFilterByParam
            )}
            onCreatorEntered={createEnumSetFilterHandler(
              creatorFilters,
              setCreatorFilterByParam
            )}
            onCreatedAfterEntered={createDateFilterHandler(
              createdFilters,
              setCreatedFilterByParam,
              ">="
            )}
            onCreatedBeforeEntered={createDateFilterHandler(
              createdFilters,
              setCreatedFilterByParam,
              "<="
            )}
            onModifiedAfterEntered={createDateFilterHandler(
              modifiedFilters,
              setModifiedFilterByParam,
              ">="
            )}
            onModifiedBeforeEntered={createDateFilterHandler(
              modifiedFilters,
              setModifiedFilterByParam,
              "<="
            )}
          />
        </div>

        {/* right section */}
        <div className="flex items-center">
          {showSortOrderMenu && (
            <SortOrderMenu
              onSelect={(orderBy) => setOrderByParam(orderBy)}
              order={orderBy}
            />
          )}
        </div>
      </div>
      {(statusFilters && statusFilters.length) ||
      (priorityFilters && priorityFilters.length) ||
      (creatorFilters && creatorFilters.length) ||
      (createdFilters && createdFilters.length) ||
      (modifiedFilters && modifiedFilters.length) ? (
        <div className="flex pl-2 lg:pl-9 pr-6 border-b border-gray-850 h-8">
          <FilterStatus
            filter={statusFilters}
            onDelete={() => setStatusFilterByParam(null)}
            label="Status"
          />
          <FilterStatus
            filter={priorityFilters}
            onDelete={() => setPriorityFilterByParam(null)}
            label="Priority"
          />
          <FilterStatus
            filter={creatorFilters}
            onDelete={() => setCreatorFilterByParam(null)}
            label="Creator"
          />
          <DateFilterStatus
            filter={createdFilters}
            onDelete={() => setCreatedFilterByParam(null)}
            label="Created"
          />
          <DateFilterStatus
            filter={modifiedFilters}
            onDelete={() => setModifiedFilterByParam(null)}
            label="Modified"
          />
        </div>
      ) : null}
    </>
  );
};

function createDateFilterHandler(
  filters: DateQueryArg[] | null,
  setFilters: (f: DateQueryArg[] | null) => Promise<unknown>,
  op: Op
) {
  // TODO: do not allow more than one op of same type.
  return async (date: Date) => {
    const set = new Set(filters);
    const encoded: DateQueryArg = `${date.getTime()}|${op}`;
    if (set.has(encoded)) {
      set.delete(encoded);
    } else {
      set.add(encoded);
    }
    await setFilters(set.size === 0 ? null : [...set]);
  };
}

function createEnumSetFilterHandler<T>(
  filters: T[] | null,
  setFilters: (f: T[] | null) => Promise<unknown>
) {
  return async (e: T) => {
    const set = new Set(filters);
    if (set.has(e)) {
      set.delete(e);
    } else {
      set.add(e);
    }
    await setFilters(set.size === 0 ? null : [...set]);
  };
}

export default memo(TopFilter);
