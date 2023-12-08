/* eslint-disable @typescript-eslint/no-explicit-any */
import {test, expect, vi} from 'vitest';
import {
  findCreates,
  findDeletes,
  findMaxClientViewVersion,
  findRowsForFastforward,
  getCVR,
  recordUpdates,
  SyncedTables,
  syncedTables,
} from '../cvr';
import {nanoid} from 'nanoid';

vi.mock('../../pg');

import {Executor, withExecutor} from '../../pg';
import {createComment, putDescription, putIssue} from '../../data';
import {makeComment, makeDescription, makeIssue, reset} from './example-data';
import {exec} from 'child_process';

test('getCVR', async () => {
  const cgid = nanoid();
  await withExecutor(async executor => {
    await executor(/*sql*/ `INSERT INTO "client_view"
        ("client_group_id", "client_version", "version") VALUES
        ('${cgid}', 1, 1)`);

    let cvr = await getCVR(executor, cgid, 1);
    expect(cvr).toEqual({
      clientGroupID: cgid,
      clientVersion: 1,
      order: 1,
    });
    cvr = await getCVR(executor, nanoid(), 1);
    expect(cvr).toBeUndefined();
    cvr = await getCVR(executor, cgid, 2);
    expect(cvr).toBeUndefined();
  });
  expect(true).toBe(true);
});

test('findMaxClientViewVersion', async () => {
  const cgid = nanoid();
  await withExecutor(async executor => {
    await executor(/*sql*/ `INSERT INTO "client_view"
        ("client_group_id", "version", "client_version") VALUES
        ('${cgid}', 1, 1), ('${cgid}', 2, 2), ('${cgid}', 3, 3)`);

    let version = await findMaxClientViewVersion(executor, cgid);
    expect(version).toBe(3);

    version = await findMaxClientViewVersion(executor, 'asdf');
    expect(version).toBe(0);
  });

  expect(true).toBe(true);
});

test('findRowsForFastForward', async () => {
  const prepWithData = async (
    executor,
    args: {readonly clientGroupID: string},
  ) => {
    await putIssue(executor, makeIssue());
    await putDescription(executor, makeDescription());
    await createComment(executor, makeComment());

    for (const table of syncedTables) {
      const rows = await findCreates(
        executor,
        table,
        args.clientGroupID,
        0,
        100,
      );
      await recordUpdates(executor, table, args.clientGroupID, 1, rows);
    }
  };

  const cases = [
    [
      'Empty tables so no rows',
      {
        clientGroupID: nanoid(),
        cookieClientViewVersion: 0,
        excludeIds: [],
      },
      async () => {
        // empty
      },
      Object.fromEntries(syncedTables.map(t => [t, []])),
    ],
    [
      'Tables have data but no rows for the given client group',
      {
        clientGroupID: nanoid(),
        cookieClientViewVersion: 0,
        excludeIds: [],
      },
      async executor => {
        await putIssue(executor, makeIssue());
        await putDescription(executor, makeDescription());
        await createComment(executor, makeComment());
      },
      Object.fromEntries(syncedTables.map(t => [t, []])),
    ],
    [
      'Tables have data and have rows for the given client group but we are already up to date',
      {
        clientGroupID: nanoid(),
        cookieClientViewVersion: 1,
        excludeIds: [],
      },
      prepWithData,
      Object.fromEntries(syncedTables.map(t => [t, []])),
    ],
    [
      'Tables have data and have rows for the given client group. We are not up to date so ff should return rows',
      {
        clientGroupID: nanoid(),
        cookieClientViewVersion: 0,
        excludeIds: [],
      },
      prepWithData,
      (table: SyncedTables, rows: readonly {id: string}[]) => {
        switch (table) {
          case 'issue':
            expect(rows.map(r => r.id)).toEqual(['iss-0']);
            break;
          case 'description':
            expect(rows.map(r => r.id)).toEqual(['iss-0']);
            break;
          case 'comment':
            expect(rows.map(r => r.id)).toEqual(['com-0']);
            break;
        }
      },
    ],
    [
      'Same test as above but we pass all ids as excluded',
      {
        clientGroupID: nanoid(),
        cookieClientViewVersion: 0,
        excludeIds: ['iss-0', 'com-0'],
      },
      prepWithData,
      Object.fromEntries(syncedTables.map(t => [t, []])),
    ],
  ] as TestCase[];

  // do these sequentially since better-sqlite3 will not work as expected
  // if we're running multiple transactions at once.
  await makeCheckCases(
    cases,
    async (executor, table, args) =>
      await findRowsForFastforward(
        executor,
        table,
        args.clientGroupID,
        args.cookieClientViewVersion,
        args.excludeIds,
      ),
  )();
});

type CaseArgs = {
  readonly clientGroupID: string;
  readonly cookieClientViewVersion: number;
  readonly excludeIds: readonly string[];
};
type TestCase = [
  string,
  CaseArgs,
  (executor: Executor, args?: CaseArgs) => Promise<void>,
  (
    | Record<SyncedTables, readonly {id: string}[]>
    | ((table: SyncedTables, rows: unknown) => void)
  ),
];

function makeCheckCases<T>(
  cases: readonly TestCase[],
  fn: (executor: Executor, table: SyncedTables, args: CaseArgs) => Promise<T>,
) {
  return async () =>
    await withExecutor(async executor => {
      for (const [, args, seed, expected] of cases) {
        await clearTables(executor);
        reset();
        await seed(executor, args);
        for (const table of syncedTables) {
          const rows = await fn(executor, table, args);
          if (typeof expected === 'function') {
            expected(table, rows);
          } else {
            expect(rows).toEqual(expected[table]);
          }
        }
      }
    });
}

test('findDeletes', async () => {
  // test:
  // 1. both empty
  // 2. cvr empty, db has data
  // 3. cvr has data, db empty
  // 4. cvr has data, db has data and they are equal
  // 5. cvr has data, db has data and they are not equal
  // 6. We don't gather deletes that were already sent
  const cases: TestCase[] = [
    [
      'Empty tables so no rows',
      {
        clientGroupID: nanoid(),
        cookieClientViewVersion: 0,
        excludeIds: [],
      },
      async () => {
        // empty
      },
      Object.fromEntries(syncedTables.map(t => [t, []])) as any,
    ],
    // [
    //   'CVR has entries but tables are empty -> deletes',
    //   {
    //     clientGroupID: nanoid(),
    //     cookieClientViewVersion: 0,
    //     excludeIds: [],
    //   },
    //   async executor => {},
    // ],
  ];

  await makeCheckCases(
    cases,
    async (executor, table, args) =>
      await findDeletes(
        executor,
        table,
        args.clientGroupID,
        args.cookieClientViewVersion,
      ),
  )();
});

test('findPuts', async () => {
  //
});

test('findCreates', async () => {
  //
});

async function clearTables(executor: Executor) {
  for (const table of syncedTables) {
    await executor(/*sql*/ `DELETE FROM "${table}"`);
  }
  await executor(/*sql*/ `DELETE FROM "client_view"`);
  await executor(/*sql*/ `DELETE FROM "client_view_entry"`);
}

/*
await putIssue(executor, makeIssue());
*/
