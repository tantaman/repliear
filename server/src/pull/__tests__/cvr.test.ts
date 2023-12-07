import {test, expect, vi} from 'vitest';
import {getCVR} from '../cvr';

vi.mock('../../pg');

import {withExecutor} from '../../pg';

test('getCVR', async () => {
  await withExecutor(async executor => {
    await executor(
      /*sql*/ `INSERT INTO "client_view" ("client_group_id", "client_version", "version") VALUES ('1', 1, 1)`,
    );

    let cvr = await getCVR(executor, '1', 1);
    expect(cvr).toEqual({
      clientGroupID: '1',
      clientVersion: 1,
      order: 1,
    });
    cvr = await getCVR(executor, '2', 1);
    expect(cvr).toBeUndefined();
    cvr = await getCVR(executor, '1', 2);
    expect(cvr).toBeUndefined();
  });
  expect(true).toBe(true);
});

test('findMaxClientViewVersion', async () => {
  expect(true).toBe(true);
});
