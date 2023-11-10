import type {PGConfig} from './pgconfig/pgconfig.js';
import type {Executor} from './pg.js';

export async function createDatabase(executor: Executor, dbConfig: PGConfig) {
  console.log('creating database');
  const schemaVersion = await dbConfig.getSchemaVersion(executor);
  if (schemaVersion < 0 || schemaVersion > 1) {
    throw new Error('Unexpected schema version: ' + schemaVersion);
  }
  if (schemaVersion === 0) {
    await createSchemaVersion1(executor);
  }
}

export async function createSchemaVersion1(executor: Executor) {
  await executor(
    'CREATE TABLE replicache_meta (key text PRIMARY KEY, value json)',
  );
  await executor(
    "insert into replicache_meta (key, value) values ('schemaVersion', '1')",
  );

  // cvrversion is null until first pull initializes it.
  await executor(/*sql*/ `CREATE TABLE replicache_client_group (
    id VARCHAR(36) PRIMARY KEY NOT NULL,
    cvrversion INTEGER null,
    clientversion INTEGER NOT NULL,
    lastmodified TIMESTAMP(6) NOT NULL
    )`);

  await executor(/*sql*/ `CREATE TABLE replicache_client (
    id VARCHAR(36) PRIMARY KEY NOT NULL,
    clientgroupid VARCHAR(36) NOT NULL,
    lastmutationid INTEGER NOT NULL,
    clientversion INTEGER NOT NULL,
    lastmodified TIMESTAMP(6) NOT NULL
    )`);

  await executor(
    /*sql*/ `CREATE TYPE priority AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT')`,
  );
  await executor(
    /*sql*/ `CREATE TYPE status AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED')`,
  );

  await executor(/*sql*/ `CREATE TABLE issue (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "priority" priority,
    "status" status,
    "modified" BIGINT NOT NULL,
    "created" BIGINT NOT NULL,
    "creator" VARCHAR(36) NOT NULL,
    "kanbanorder" VARCHAR(36),
    "rowversion" INTEGER NOT NULL
  )`);

  await executor(/*sql*/ `CREATE TABLE comment (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL,
    "issueid" VARCHAR(36) NOT NULL REFERENCES issue("id") ON DELETE CASCADE,
    "created" BIGINT NOT NULL,
    "body" text NOT NULL,
    "creator" VARCHAR(36) NOT NULL,
    "rowversion" INTEGER NOT NULL
  )`);

  await executor(/*sql*/ `CREATE TABLE description (
    "id" VARCHAR(36) PRIMARY KEY NOT NULL REFERENCES issue("id") ON DELETE CASCADE,
    "body" text NOT NULL,
    "rowversion" INTEGER NOT NULL
  )`);

  await executor(/*sql*/ `CREATE TABLE "cvr" (
    "client_group_id" VARCHAR(36) NOT NULL,
    "order" INTEGER NOT NULL,
    "client_version" INTEGER NOT NULL,
    PRIMARY KEY ("client_group_id", "order")
  )`);

  await executor(/*sql*/ `CREATE TABLE "cvr_entry" (
    "client_group_id" VARCHAR(36) NOT NULL,
    "order" INTEGER NOT NULL,
    "tbl" INTEGER NOT NULL,
    "row_id" VARCHAR(36) NOT NULL,
    "row_version" INTEGER NOT NULL,
    -- unique by client_group_id, tbl, row_id
    -- 1. A missing row version is semantically the same as a behind row version
    -- 2. Our CVR is recursive. CVR_n = CVR_n-1 + (changes since CVR_n-1)
    PRIMARY KEY ("client_group_id", "tbl", "row_id")
  )`);

  // Index for `EXIST` queries when sending new changes to the client
  // from the pull endpoint.
  // We can use the primary key index to fulfill the exists query.
  // await executor(/*sql*/ `CREATE INDEX "cvr_entry_id_version" ON "cvr_entry" (
  //   "row_id", "row_version"
  // )`);

  await executor(/*sql*/ `CREATE TABLE "cvr_delete_entry" (
    "client_group_id" VARCHAR(36) NOT NULL,
    "order" INTEGER NOT NULL,
    "tbl" INTEGER NOT NULL,
    "row_id" VARCHAR(36) NOT NULL,
    PRIMARY KEY ("client_group_id", "order", "tbl", "row_id")
  )`);
}
// TODO: we only need to keeo `row_id`, `version`, `table_name` uniquely per client group
// since if a new row version is written if effectively evicts the old one.
// Deletes... this is a problem.

// TODO: later CVRs can use prior CVRs to build their data. Right?
// If the client has the next order then we can assume they received the prior order.