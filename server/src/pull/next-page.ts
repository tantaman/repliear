import type {Executor} from '../pg';
import type {Comment, Description, Issue} from 'shared';
import {
  findCreates,
  findRowsForFastforward,
  findDeletions,
  findUpdates,
} from './cvr';

const LIMIT = 3000;

type Page = {
  issues: Issue[];
  descriptions: Description[];
  comments: Comment[];
  issueDeletes: string[];
  descriptionDeletes: string[];
  commentDeletes: string[];
};

export type Deletes = {
  issues: string[];
  descriptions: string[];
  comments: string[];
};

export type Updates = {
  issues: Issue[];
  descriptions: Description[];
  comments: Comment[];
};

export function isPageEmpty(page: Page) {
  return (
    page.issues.length +
      page.comments.length +
      page.descriptions.length +
      page.descriptionDeletes.length +
      page.commentDeletes.length +
      page.issueDeletes.length ===
    0
  );
}

export function hasNextPage(page: Page) {
  return (
    page.issues.length +
      page.comments.length +
      page.descriptions.length +
      page.descriptionDeletes.length +
      page.commentDeletes.length +
      page.issueDeletes.length >=
    LIMIT
  );
}

/**
 * Fast forwards against all tables that are being synced.
 */
export async function fastforward(
  executor: Executor,
  clientGroupID: string,
  cookieClientViewVersion: number,
  deletes: Deletes,
  updates: Updates,
) {
  const [issues, descriptions, comments] = await Promise.all([
    findRowsForFastforward(
      executor,
      'issue',
      clientGroupID,
      cookieClientViewVersion,
      deletes.issues.concat(updates.issues.map(i => i.id)),
    ),
    findRowsForFastforward(
      executor,
      'description',
      clientGroupID,
      cookieClientViewVersion,
      deletes.descriptions.concat(updates.descriptions.map(i => i.id)),
    ),
    findRowsForFastforward(
      executor,
      'comment',
      clientGroupID,
      cookieClientViewVersion,
      deletes.comments.concat(updates.comments.map(i => i.id)),
    ),
  ]);

  return {
    issues,
    descriptions,
    comments,
  };
}

export async function getAllDeletes(
  executor: Executor,
  clientGroupID: string,
  cookieClientViewVersion: number,
) {
  const [issues, descriptions, comments] = await Promise.all([
    findDeletions(executor, 'issue', clientGroupID, cookieClientViewVersion),
    findDeletions(
      executor,
      'description',
      clientGroupID,
      cookieClientViewVersion,
    ),
    findDeletions(executor, 'comment', clientGroupID, cookieClientViewVersion),
  ]);

  return {
    issues,
    descriptions,
    comments,
  };
}

/**
 * Returns rows that the client has and have been modified on the server.
 *
 * We fetch these without limit so that the client always receives a total
 * mutation and never a partial mutation result.
 *
 * @param executor
 * @param clientGroupID
 * @returns
 */
export async function getAllUpdates(executor: Executor, clientGroupID: string) {
  const [issues, descriptions, comments] = await Promise.all([
    findUpdates(executor, 'issue', clientGroupID),
    findUpdates(executor, 'description', clientGroupID),
    findUpdates(executor, 'comment', clientGroupID),
  ]);

  return {
    issues,
    descriptions,
    comments,
  };
}

// TODO: we can change the queries here.
// We've already found:
// 1. deletes
// 2. mutations of stuff sent to client
//
// So now... we really just need things that do not exist in the cve table
// and do exist in the base table. We can ignore version all together
// since that would have been gathered in the first two steps.
// This should also mean we do not need the exclusion list.
export async function readNextPage(
  executor: Executor,
  clientGroupID: string,
  order: number,
  deletes: Deletes,
  updates: Updates,
) {
  let remaining =
    LIMIT -
    deletes.issues.length -
    deletes.descriptions.length -
    deletes.comments.length -
    updates.issues.length -
    updates.descriptions.length -
    updates.comments.length;
  if (remaining <= 0) {
    return {
      issues: [],
      descriptions: [],
      comments: [],
    };
  }

  // TODO: optimize to not require 3 queries in turn?
  const issues = await findCreates(
    executor,
    'issue',
    clientGroupID,
    order,
    remaining,
  );

  remaining -= issues.length;
  if (remaining <= 0) {
    return {
      issues,
      descriptions: [],
      comments: [],
    };
  }

  const descriptions = await findUnsentItems(
    executor,
    'description',
    clientGroupID,
    order,
    remaining,
  );

  remaining -= descriptions.length;
  if (remaining <= 0) {
    return {
      issues,
      descriptions,
      comments: [],
    };
  }

  const comments = await findUnsentItems(
    executor,
    'comment',
    clientGroupID,
    order,
    remaining,
  );

  return {
    issues,
    descriptions,
    comments,
  };
}
