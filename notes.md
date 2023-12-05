# TODO:

1. Fast-forward based on CVR entries
2. Remove sync lock
3. Pull from poke / find all the data that changed. If exceeds limit, just send it
4. Finding deletes current cookie
   1. Scan all CVRs (past and future), compare against base tables
   2. Now we have "deleted set"
   3. See if we sent any part of the deleted set previously (rows < now) and don't send if not. This would be `deleted = false and version <= cookie`
5. Sending deletes for old cookie
   1. Fast-forward
   2. Send all entries where `deleted = true` and cookie > current cookie

- Materialite windowed queries virtual table
- Materialite ordered source and unordered sink

psql -d postgres -c 'create database repliear2'

- Deletion culling tagged to prior CVR?
- Viewed page sync?

- do check db for cvr so if we drop db we re-sync. rather than this cookie reconstitution
