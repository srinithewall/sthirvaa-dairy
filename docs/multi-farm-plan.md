# Multi-farm plan: opening the dairy app to other farmers

Goal: any farmer can sign up, create their own farm, and use herds, milk, feed, staff, accounts
and reports for that farm only, without ever seeing another farm's data. Sthirvaa becomes
**farm #1** and keeps working exactly as today throughout.

## What the code looks like today (surveyed 2026-11-18)

| Area | Today | What has to change |
|---|---|---|
| Data | 68 JPA entities, none carry a farm id | Add `farm_id` to every farm-owned table |
| Queries | Spring Data + JPQL, **no native queries**; `JdbcTemplate` is only used in migrations, seeders and cleanup | Hibernate 6 `@TenantId` filters every entity query automatically; only the 6 JdbcTemplate classes need a manual review |
| Schema | `spring.jpa.hibernate.ddl-auto=update`, no Flyway | Back-filling `farm_id` on existing rows needs real migrations: introduce Flyway first |
| Unique keys | 24, e.g. `Herd.tag_number`, `Inventory.item_name`, `Staff.employee_id`, `StoreSale.bill_no`, `BankTransaction.dedupe_key`, `AuditPackage.period_from` | Become unique **per farm**: `(farm_id, tag_number)` etc. |
| Caches | `CacheConfig`: breeds, categories, role permissions, animal requirements, feed master, keyed `'all'` | Per-farm caches must include the farm id in the key, or one farm sees another's list |
| Scheduled jobs | 5: AMCS morning/evening sync, notification scheduler, daily chores, chore reminders | Loop over farms, set the farm context for each run |
| Files | `FileController` stores to R2 as `folder/uuid.ext` | Prefix with `farm-{id}/`, and check the farm before serving or deleting |
| Auth | JWT subject = email, `User` has a `role` and no farm | User gets `farmId`; JWT carries it; filter sets it for the request |
| Hard-coded farm | Kotak bank feed (`KotakClient`, `BankFeedService`, `StatementFileParser`), AMCS society name, AMCS env credentials, "Sthirvaa" in UI (`layout.tsx`, `Navbar`, `Sidebar`, several pages) | Per-farm settings and branding; Kotak/AMCS live features stay farm #1 only until made per-farm |

## Which tables are shared and which belong to a farm

**Shared reference data** (one copy, read-only for farms, edited by the platform admin):
`Breed`, `FeedKnowledge`, `FeedNutrition`, `AnimalRequirement`, `SemenCatalog`.

**Belongs to a farm**: everything else, including herds and events, milk and production, feed
plans and rations, expenses, income, ledger, bank, staff and salary, assets, activities and
chores, customers, subscriptions, orders, and the store (FeedShop) tables.

To decide in phase 1: `Category` and `FeedMaster` (shared default list + farm's own additions,
or fully per farm), and whether `RolePermission` stays per role or becomes per farm (per role is
enough for v1).

## Phases

Each phase ships on its own and leaves the app working for Sthirvaa.

### Phase 0: safety net (before touching data)
- Full `mysqldump` of production into `db backups/`.
- Add **Flyway**; baseline it on the current production schema. Keep `ddl-auto=validate` from
  now on so schema changes are explicit and reviewable.
- A local copy of the production database to rehearse every migration on.

**Done when:** the app runs on Flyway with no schema difference and a restore has been tested.

**Status (2026-11-18): done locally, not yet deployed.**
- Backup: `db backups/pre-flyway_2026-11-18_000220.sql` (all 70 tables).
- Flyway 11.7 (`flyway-core` + `flyway-mysql`), `V1__baseline.sql` = production schema (69 tables;
  `herds_age_backup` left out, it is not mapped by any entity). `ddl-auto` is now
  `${JPA_DDL_AUTO:validate}`.
- Rehearsed in a Docker MySQL 8.0 copy (`dairy-rehearsal`, port 3307):
  - **existing database** (what production will see): Flyway records it as version 1 without
    running anything, Hibernate validation passes, the app starts;
  - **empty database**: V1 creates the schema, the app starts, and its columns and indexes are
    identical to production's (847 columns compared).
- Unit tests on `main` + Phase 0: 188/189 pass. `FarmActivityServiceResyncTest.todaysOccurrenceIsGeneratedWhenTheEditMakesItDueNow`
  was already failing before this change (it expects `saveAll`, the service now saves one by one).

**On the first deploy** the production backend creates `flyway_schema_history` and records the
baseline; nothing else in the schema changes. If validation ever blocks a start in an emergency,
put `JPA_DDL_AUTO=update` in `~/dairy-deployment/amcs.env` and restart, then fix it properly.
Note that `run-backend.bat` points at the production database, so starting it from this branch does
the same baseline there.

### How schema changes work from now on
- Hibernate no longer adds columns. Changing an entity = also adding
  `src/main/resources/db/migration/V<next>__<what>.sql` (e.g. `V2__add_farms.sql`).
- Never edit a migration that has run anywhere; add a new one.
- Rehearse on the copy first:
  `DB_URL=jdbc:mysql://127.0.0.1:3307/dairy?...`, `DB_PASSWORD` and `SPRING_DATASOURCE_PASSWORD`
  set to the rehearsal password (your user-level `SPRING_DATASOURCE_PASSWORD` otherwise wins),
  `SCHEDULER_ENABLED=false`, `SERVER_PORT=8090`.
- The old startup fix-ups (`StoreSchemaMigration`, `BcsHalfPointMigration`,
  `RolePermissionMigration`, `DatabaseCleanupService`, the index drop in `FeedDataSeeder`) are
  already reflected in V1 and are no-ops now; fold them into Flyway or delete them in Phase 1.

### Phase 1: farms exist, everything belongs to farm #1
- New `farms` table (id, name, owner user, village, created at, status).
- Flyway migration per table: add `farm_id` nullable → set `1` on all rows → make it `NOT NULL`
  → index it. Replace the 24 unique keys with `(farm_id, …)` versions.
- `User.farmId`; all current users go to farm #1.
- Entities get `@TenantId private Long farmId;` (a `FarmOwned` base class keeps this in one place).
- `CurrentTenantIdentifierResolver` that returns the farm id from the request, a fixed "system"
  value for startup jobs.

**Done when:** the app behaves exactly as before; every row has `farm_id = 1`.

### Phase 2: isolation is enforced
- JWT gets a `farmId` claim; `AuthTokenFilter` puts it in a `FarmContext` (thread-local) for the
  request and clears it afterwards. A farm id sent by the browser is never trusted.
- Scheduled jobs: for each active farm, set the context, run, clear.
- Review the 6 JdbcTemplate classes (`BcsHalfPointMigration`, `DatabaseCleanupService`,
  `FeedDataSeeder`, `RolePermissionMigration`, `StoreSchemaMigration`, `SampleDataInitializer`):
  one-off migrations stay farm #1; `DatabaseCleanupService` must be scoped or removed.
- Caches: add the farm id to keys for per-farm caches.
- R2: new uploads go under `farm-{id}/`; serving checks the farm.
- **Isolation test suite**: create farm A and farm B, put data in both, call every list/get/
  update/delete endpoint as A with B's ids, and expect empty lists / 404 every time. This test is
  the gate: no other farmer is invited until it passes.

**Done when:** a test farm #2 on the rehearsal database sees none of Sthirvaa's data, and the
isolation suite passes in CI.

### Phase 3: per-farm settings and branding
- `Setting` rows become per farm (farm name, logo, village, milk society, rates, currency
  rounding stays whole rupees).
- AMCS: credentials move from `amcs.env` into an encrypted per-farm table; the sync loops over
  linked farms. Dispatch/income creation uses that farm's society name.
- Kotak bank feed: farm #1 only (feature flag); other farms get CSV import.
- UI: farm name and logo from settings instead of "Sthirvaa" in `Navbar`, `Sidebar`, `layout.tsx`.

### Phase 4: sign-up and platform admin
- Public sign-up: mobile number + OTP (or email), farm name, village → creates user (role ADMIN of
  the new farm) + farm + default categories, activities and permissions.
- Owners invite their own staff/partners/finance users into their farm.
- New **platform admin** (you): list farms, suspend a farm, edit shared reference data. Platform
  admin is separate from farm ADMIN.
- Terms and privacy notice (DPDP Act 2023): what is stored, export and delete-my-farm.

### Phase 5: AMCS member linking
The consented "Link my AMCS account" flow, per farm, once the AMCS login request has been captured
and confirmed to work without logging the member out of their phone app.

## Order and rough size

| Phase | Risk | Size |
|---|---|---|
| 0 Safety net / Flyway | Medium (schema baseline) | Small |
| 1 Farm id everywhere | **High** (touches every table) | Large |
| 2 Isolation enforced + tests | **High** (data leak if missed) | Medium |
| 3 Per-farm settings | Low | Medium |
| 4 Sign-up + platform admin | Low | Medium |
| 5 AMCS member linking | Medium (unofficial API) | Small–medium |

## Open decisions for you
1. Can one person belong to more than one farm (e.g. a vet or a consultant)? v1 assumes **no**.
2. Free, or paid per farm later? Affects whether we need plans/limits in `farms`.
3. FeedShop: do the farmers who buy from your store (`StoreFarmer`) become farm users who see
   their own purchases? Easy to link once they have accounts.
4. Hosting: one server for all farms is fine to start; backups become more important because one
   database now holds everyone's data.
