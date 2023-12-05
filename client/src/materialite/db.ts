import {Materialite} from '@vlcn.io/materialite';
import {MutableSetSource} from '@vlcn.io/materialite/dist/sources/MutableSetSource';
import {Issue, Order, orders} from 'shared';
import {getOrderValue} from '../reducer';

const m = new Materialite();
const issueComparators = Object.fromEntries(
  orders.map(order => {
    return [
      order,
      (l: Issue, r: Issue) => {
        const lValue = getOrderValue(order, l);
        const rValue = getOrderValue(order, r);
        return lValue < rValue ? -1 : lValue > rValue ? 1 : 0;
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
