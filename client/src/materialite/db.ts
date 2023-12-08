import {Materialite} from '@vlcn.io/materialite';
import {MutableSetSource} from '@vlcn.io/materialite/dist/sources/MutableSetSource';
import {Issue, Order, orders} from 'shared';
import {priorityOrderValues, statusOrderValues} from '../issue/issue';

const m = new Materialite();
const issueComparators = Object.fromEntries(
  orders.map(order => {
    return [
      order,
      (l: Issue, r: Issue) => {
        let comp = 0;
        switch (order) {
          case 'CREATED':
            comp = r.created - l.created;
            break;
          case 'MODIFIED':
            comp = r.modified - l.modified;
            break;
          case 'STATUS':
            comp = statusOrderValues[l.status] - statusOrderValues[r.status];
            if (comp === 0) {
              comp = r.modified - l.modified;
            }
            break;
          case 'PRIORITY':
            comp =
              priorityOrderValues[l.priority] - priorityOrderValues[r.priority];
            if (comp === 0) {
              comp = r.modified - l.modified;
            }
            break;
          case 'KANBAN':
            comp = l.kanbanOrder.localeCompare(r.kanbanOrder);
            break;
        }
        if (comp === 0) {
          comp = l.id.localeCompare(r.id);
        }
        return comp;
      },
    ] as const;
  }),
) as Record<Order, (l: Issue, r: Issue) => number>;

// We could build the indices on the fly when the user selects a given ordering.
// Creating all the orderings up front for now.
class IssueCollection {
  readonly #orderedIndices = new Map<Order, MutableSetSource<Issue>>();

  add(issue: Issue) {
    for (const index of this.#orderedIndices.values()) {
      index.add(issue);
    }
  }

  delete(issue: Issue) {
    for (const index of this.#orderedIndices.values()) {
      index.delete(issue);
    }
  }

  // We omit `add` and `delete` on the returned type since
  // the developer should mutate `issueCollection` which keeps all the indices in sync.
  getSortedSource(
    order: Order,
  ): Omit<MutableSetSource<Issue>, 'add' | 'delete'> {
    let index = this.#orderedIndices.get(order);
    if (!index) {
      index = m.newSortedSet<Issue>(issueComparators[order]);
      const newIndex = index;
      m.tx(() => {
        const existingIndex = [...this.#orderedIndices.values()][0];
        if (existingIndex) {
          for (const issue of existingIndex.value) {
            newIndex.add(issue);
          }
        }
      });
      this.#orderedIndices.set(order, index);
    }
    return index;
  }
}

export const db = {
  issues: new IssueCollection(),
  tx: m.tx.bind(m),
};
