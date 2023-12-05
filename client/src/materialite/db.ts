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
  readonly #orderedIndices: Record<Order, MutableSetSource<Issue>>;

  constructor() {
    this.#orderedIndices = Object.fromEntries(
      orders.map(order => {
        return [order, m.newSortedSet(issueComparators[order])] as const;
      }),
    ) as Record<Order, MutableSetSource<Issue>>;
  }

  add(issue: Issue) {
    for (const order of orders) {
      this.#orderedIndices[order].add(issue);
    }
  }

  delete(issue: Issue) {
    for (const order of orders) {
      this.#orderedIndices[order].delete(issue);
    }
  }

  // We omit `add` and `delete` on the returned type since
  // the developer should mutate `issueCollection` which keeps all the indices in sync.
  getSortedSource(
    order: Order,
  ): Omit<MutableSetSource<Issue>, 'add' | 'delete'> {
    return this.#orderedIndices[order];
  }
}

export const db = {
  issues: new IssueCollection(),
  tx: m.tx.bind(m),
};
