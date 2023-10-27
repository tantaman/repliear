import React, { memo, useCallback, useEffect } from "react";
import type {
  ExperimentalDiff as Diff,
  ReadTransaction,
  Replicache,
} from "replicache";
import LeftMenu from "./left-menu";
import type { M } from "./mutators";
import {
  Issue,
  issueFromKeyAndValue,
  ISSUE_KEY_PREFIX,
  Order,
  orderEnumSchema,
  Description,
  Comment,
  IssueUpdate,
  reverseTimestampSortKey,
  statusOrderValues,
  priorityOrderValues,
  IssueUpdateWithID,
  Priority,
  Status,
} from "./issue";
import { useState } from "react";
import TopFilter from "./top-filter";
import IssueList from "./issue-list";
import { queryTypes, useQueryState } from "next-usequerystate";
import IssueBoard from "./issue-board";
import { minBy, pickBy } from "lodash";
import IssueDetail from "./issue-detail";
import { generateKeyBetween } from "fractional-indexing";
import { useSubscribe } from "replicache-react";
import classnames from "classnames";
import { getPartialSyncState, PartialSyncState } from "./control";
import type { UndoManager } from "@rocicorp/undo";
import { HotKeys } from "react-hotkeys";
import {
  IMemorableSource,
  DifferenceStream,
  Materialite,
  PersistentTreap,
  PersistentTreeView,
} from "@vlcn.io/materialite";
import {
  DateQueryArg,
  getCreatedFilter,
  getCreatorFilter,
  getCreators,
  getModifiedFilter,
  getPriorities,
  getPriorityFilter,
  getStatuses,
  getStatusFilter,
  getViewFilter,
  getViewStatuses,
  hasNonViewFilters as doesHaveNonViewFilters,
} from "./filters";

const materialite = new Materialite();

function getIssueOrder(view: string | null, orderBy: string | null): Order {
  if (view === "board") {
    return Order.KANBAN;
  }
  const parseResult = orderEnumSchema.safeParse(orderBy);
  return parseResult.success ? parseResult.data : Order.MODIFIED;
}

function getTitle(view: string | null) {
  switch (view?.toLowerCase()) {
    case "active":
      return "Active issues";
    case "backlog":
      return "Backlog issues";
    case "board":
      return "Board";
    default:
      return "All issues";
  }
}

function getOrderValue(issueOrder: Order, issue: Issue): string {
  let orderValue: string;
  switch (issueOrder) {
    case Order.CREATED:
      orderValue = reverseTimestampSortKey(issue.created, issue.id);
      break;
    case Order.MODIFIED:
      orderValue = reverseTimestampSortKey(issue.modified, issue.id);
      break;
    case Order.STATUS:
      orderValue =
        statusOrderValues[issue.status] +
        "-" +
        reverseTimestampSortKey(issue.modified, issue.id);
      break;
    case Order.PRIORITY:
      orderValue =
        priorityOrderValues[issue.priority] +
        "-" +
        reverseTimestampSortKey(issue.modified, issue.id);
      break;
    case Order.KANBAN:
      orderValue = issue.kanbanOrder + "-" + issue.id;
      break;
  }
  return orderValue;
}

function issueCountView(
  source: IMemorableSource<Issue, Map<string, Issue>>,
  filter: (i: Issue) => boolean
) {
  return source.stream.filter(filter).size().materializePrimitive(0);
}

function filteredIssuesView(
  source: IMemorableSource<Issue, Map<string, Issue>>,
  order: Order,
  filters: (((i: Issue) => boolean) | null)[]
) {
  let { stream } = source;
  for (const f of filters) {
    if (!f) {
      continue;
    }
    stream = stream.filter(f);
  }
  return stream.materialize((l: Issue, r: Issue) => {
    const comp = getOrderValue(order, l).localeCompare(getOrderValue(order, r));
    if (comp === 0) {
      return l.id.localeCompare(r.id);
    }
    return comp;
  });
}

function onNewDiff(diff: Diff) {
  if (diff.length === 0) {
    return;
  }

  const start = performance.now();
  materialite.tx(() => {
    for (const diffOp of diff) {
      if ("oldValue" in diffOp) {
        allIssueSet.delete(
          issueFromKeyAndValue(diffOp.key as string, diffOp.oldValue)
        );
      }
      if ("newValue" in diffOp) {
        allIssueSet.add(
          issueFromKeyAndValue(diffOp.key as string, diffOp.newValue)
        );
      }
    }
  });

  const duration = performance.now() - start;
  console.log(`Diff duration: ${duration}ms`);
}

type AppProps = {
  rep: Replicache<M>;
  undoManager: UndoManager;
};

const allIssueSet = materialite.newMutableMap<string, Issue>(
  (issue) => issue.id
);
type IssueViews = {
  filteredIssues: PersistentTreeView<Issue>["data"];
  issueCount: number;
  hasNonViewFilters: boolean;
  // minKanban: Issue;
};
const App = ({ rep, undoManager }: AppProps) => {
  const [view] = useQueryState("view");
  const [priorityFilter] = useQueryState(
    "priorityFilter",
    queryTypes.array<Priority>(
      queryTypes.stringEnum<Priority>(Object.values(Priority))
    )
  );
  const [statusFilter] = useQueryState(
    "statusFilter",
    queryTypes.array<Status>(
      queryTypes.stringEnum<Status>(Object.values(Status))
    )
  );
  const [creatorFilter] = useQueryState(
    "creatorFilter",
    queryTypes.array<string>(queryTypes.string)
  );
  const [createdFilter] = useQueryState(
    "createdFilter",
    queryTypes.array<DateQueryArg>(queryTypes.string as any)
  );
  const [modifiedFilter] = useQueryState(
    "modifiedFilter",
    queryTypes.array<DateQueryArg>(queryTypes.string as any)
  );
  const [orderBy] = useQueryState("orderBy");
  const [detailIssueID, setDetailIssueID] = useQueryState("iss");
  const [menuVisible, setMenuVisible] = useState(false);

  const [issueViews, setIssueViews] = useState<IssueViews>({
    issueCount: 0,
    filteredIssues: new PersistentTreap(),
    hasNonViewFilters: false,
  });
  const [filteredIssueStream, setFilteredIssueStream] = useState<
    DifferenceStream<Issue>
  >(allIssueSet.stream);

  useEffect(() => {
    const start = performance.now();
    const viewStatuses = getViewStatuses(view);
    const statuses = getStatuses(statusFilter);
    const statusFilterFn = getStatusFilter(viewStatuses, statuses);
    const viewFilterFn = getViewFilter(viewStatuses);
    const filterFns = [
      statusFilterFn,
      getPriorityFilter(getPriorities(priorityFilter)),
      getCreatorFilter(getCreators(creatorFilter)),
      getCreatedFilter(createdFilter),
      getModifiedFilter(modifiedFilter),
    ];

    const hasNonViewFilters = !!(
      doesHaveNonViewFilters(viewStatuses, statuses) ||
      filterFns.filter((f) => f !== null && f !== statusFilterFn).length > 0
    );

    const order = getIssueOrder(view, orderBy);
    const filterView = filteredIssuesView(allIssueSet, order, filterFns);
    const countView = issueCountView(allIssueSet, viewFilterFn);
    filterView.onChange((data) => {
      setIssueViews((last) => ({
        ...last,
        filteredIssues: data,
        hasNonViewFilters,
      }));
    });
    countView.onChange((data) => {
      setIssueViews((last) => ({
        ...last,
        issueCount: data,
        hasNonViewFilters,
      }));
    });
    // TODO (mlaw): remove the need for this call.
    // The framework knows when new views are attached and when this is needed.
    allIssueSet.recomputeAll();
    const end = performance.now();
    console.log(`Filter update duration: ${end - start}ms`);
    return () => {
      // Note: it might be useful for materialite to weakly hold views and clean up the pipeline on GC of the view
      filterView.destroy();
      countView.destroy();
    };
  }, [
    priorityFilter,
    statusFilter,
    orderBy,
    view,
    creatorFilter,
    createdFilter,
    modifiedFilter,
  ]);

  const partialSync = useSubscribe<
    PartialSyncState | "NOT_RECEIVED_FROM_SERVER"
  >(
    rep,
    async (tx: ReadTransaction) => {
      return (await getPartialSyncState(tx)) || "NOT_RECEIVED_FROM_SERVER";
    },
    "NOT_RECEIVED_FROM_SERVER"
  );

  const partialSyncComplete = partialSync === "PARTIAL_SYNC_COMPLETE";
  useEffect(() => {
    console.log("partialSync", partialSync);
    if (!partialSyncComplete) {
      rep.pull();
    }
  }, [rep, partialSync, partialSyncComplete]);

  useEffect(() => {
    return rep.experimentalWatch(onNewDiff, {
      prefix: ISSUE_KEY_PREFIX,
      initialValuesInFirstDiff: true,
    });
  }, [rep]);

  const handleCreateIssue = useCallback(
    async (issue: Omit<Issue, "kanbanOrder">, description: Description) => {
      const minKanbanOrderIssue = minBy<Issue>(
        [],
        // [...allIssueSet.data], // TODO: lazy minBy or incrementally maintain this?
        (issue) => issue.kanbanOrder
      );
      const minKanbanOrder = minKanbanOrderIssue
        ? minKanbanOrderIssue.kanbanOrder
        : null;

      await rep.mutate.putIssue({
        issue: {
          ...issue,
          kanbanOrder: generateKeyBetween(null, minKanbanOrder),
        },
        description,
      });
    },
    [rep.mutate /*state.allIssuesMap*/]
  );
  const handleCreateComment = useCallback(
    async (comment: Comment) => {
      await undoManager.add({
        execute: () => rep.mutate.putIssueComment(comment),
        undo: () => rep.mutate.deleteIssueComment(comment),
      });
    },
    [rep.mutate, undoManager]
  );

  const handleUpdateIssues = useCallback(
    async (issueUpdates: Array<IssueUpdate>) => {
      const uChanges: Array<IssueUpdateWithID> = issueUpdates.map<IssueUpdateWithID>(
        (issueUpdate) => {
          const undoChanges = pickBy(
            issueUpdate.issue,
            (_, key) => key in issueUpdate.issueChanges
          );
          const rv: IssueUpdateWithID = {
            id: issueUpdate.issue.id,
            issueChanges: undoChanges,
          };
          const { descriptionUpdate } = issueUpdate;
          if (descriptionUpdate) {
            return {
              ...rv,
              descriptionChange: descriptionUpdate.description,
            };
          }
          return rv;
        }
      );
      await undoManager.add({
        execute: () =>
          rep.mutate.updateIssues(
            issueUpdates.map(({ issue, issueChanges, descriptionUpdate }) => {
              const rv: IssueUpdateWithID = {
                id: issue.id,
                issueChanges,
              };
              if (descriptionUpdate) {
                return {
                  ...rv,
                  descriptionChange: descriptionUpdate.description,
                };
              }
              return rv;
            })
          ),
        undo: () => rep.mutate.updateIssues(uChanges),
      });
    },
    [rep.mutate, undoManager]
  );

  const handleOpenDetail = useCallback(
    async (issue: Issue) => {
      await setDetailIssueID(issue.id, { scroll: false, shallow: true });
    },
    [setDetailIssueID]
  );
  const handleCloseMenu = useCallback(() => setMenuVisible(false), [
    setMenuVisible,
  ]);
  const handleToggleMenu = useCallback(() => setMenuVisible(!menuVisible), [
    setMenuVisible,
    menuVisible,
  ]);

  const handlers = {
    undo: () => undoManager.undo(),
    redo: () => undoManager.redo(),
  };

  return (
    <HotKeys
      {...{
        keyMap,
        handlers,
      }}
    >
      <Layout
        menuVisible={menuVisible}
        view={view}
        detailIssueID={detailIssueID}
        isLoading={!partialSyncComplete}
        state={issueViews}
        issueStream={filteredIssueStream}
        rep={rep}
        onCloseMenu={handleCloseMenu}
        onToggleMenu={handleToggleMenu}
        onUpdateIssues={handleUpdateIssues}
        onCreateIssue={handleCreateIssue}
        onCreateComment={handleCreateComment}
        onOpenDetail={handleOpenDetail}
      ></Layout>
    </HotKeys>
  );
};

const keyMap = {
  undo: ["ctrl+z", "command+z"],
  redo: ["ctrl+y", "command+shift+z", "ctrl+shift+z"],
};

interface LayoutProps {
  menuVisible: boolean;
  view: string | null;
  detailIssueID: string | null;
  isLoading: boolean;
  state: IssueViews;
  issueStream: DifferenceStream<Issue>;
  rep: Replicache<M>;
  onCloseMenu: () => void;
  onToggleMenu: () => void;
  onUpdateIssues: (issueUpdates: IssueUpdate[]) => void;
  onCreateIssue: (
    issue: Omit<Issue, "kanbanOrder">,
    description: Description
  ) => void;
  onCreateComment: (comment: Comment) => void;
  onOpenDetail: (issue: Issue) => void;
}

const RawLayout = ({
  menuVisible,
  view,
  detailIssueID,
  isLoading,
  state,
  issueStream,
  rep,
  onCloseMenu,
  onToggleMenu,
  onUpdateIssues,
  onCreateIssue,
  onCreateComment,
  onOpenDetail,
}: LayoutProps) => {
  return (
    <div>
      <div className="flex w-full h-screen overflow-y-hidden">
        <LeftMenu
          menuVisible={menuVisible}
          onCloseMenu={onCloseMenu}
          onCreateIssue={onCreateIssue}
        />
        <div className="flex flex-col flex-grow min-w-0">
          <div
            className={classnames("flex flex-col", {
              hidden: detailIssueID,
            })}
          >
            <TopFilter
              onToggleMenu={onToggleMenu}
              title={getTitle(view)}
              filteredIssuesCount={
                state.hasNonViewFilters ? state.filteredIssues.size : undefined
              }
              issuesCount={state.issueCount}
              showSortOrderMenu={view !== "board"}
            />
          </div>
          <div className="relative flex flex-1 min-h-0">
            {detailIssueID && (
              <IssueDetail
                issues={state.filteredIssues}
                rep={rep}
                onUpdateIssues={onUpdateIssues}
                onAddComment={onCreateComment}
                isLoading={isLoading}
              />
            )}
            <div
              className={classnames("absolute inset-0 flex flex-col", {
                invisible: detailIssueID,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                "pointer-events-none": detailIssueID,
              })}
            >
              {view === "board" ? (
                <IssueBoard
                  issueStream={issueStream}
                  onUpdateIssues={onUpdateIssues}
                  onOpenDetail={onOpenDetail}
                />
              ) : (
                <IssueList
                  issues={state.filteredIssues}
                  onUpdateIssues={onUpdateIssues}
                  onOpenDetail={onOpenDetail}
                  view={view}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Layout = memo(RawLayout);
export default App;
