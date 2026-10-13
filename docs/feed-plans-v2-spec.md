# Feed Plans v2 — Shared Plans with Assignments

**Status:** proposed
**Scope:** backend only (`/api/feed-plans`). Frontend follows in a separate change.

## Why

Today a feed plan belongs to exactly one animal. Saving the same ration to five cows
creates five unrelated rows that merely share a name — nothing links them, and there is
no way to edit or delete any of them.

This change makes a plan a **recipe** (name + feed lines) that animals are **assigned**
to. Editing the recipe once updates every assigned animal.

### The reason this matters beyond tidiness

Plan quantities are stored as **absolute kilograms** (`feed_plan_items.quantity_kg`), but
the ADEQUATE / DEFICIENT verdict is resolved **per animal** from breed, weight, milk yield
and stage (`AnimalRequirementResolutionService`).

So the same ration is not equally correct for every animal. 12 kg of dry matter can be
ADEQUATE for one cow and DEFICIENT for a higher-yielding one. Any grouping feature that
does not surface this actively hides a nutrition problem — hence the adequacy endpoint in
§4.5, which is the point of the whole change, not an extra.

---

## 1. Current state (verified in code)

| Endpoint | Exists | Notes |
|---|---|---|
| `POST /api/feed-plans` | yes | always INSERTs; no upsert, so repeat saves duplicate |
| `GET /api/feed-plans?animalId=` | yes | |
| `GET /api/feed-plans/{planId}` | yes | |
| update | **no** | |
| delete | **no** | |

```
feed_plans       (id, herd_id NOT NULL, plan_name, plan_type, total_estimated_cost, created_at, updated_at)
feed_plan_items  (id, feed_plan_id, feed_id, quantity_kg)
```

Two already-written but unused repository methods show this was anticipated:
`FeedPlanItemRepository.deleteByFeedPlanId` and `FeedPlanRepository.findByIdAndHerdId`.

---

## 2. ⚠️ Schema trap — read before touching `FeedPlan.java`

`application.properties` sets `spring.jpa.hibernate.ddl-auto=update`. There is **no Flyway
or Liquibase** in this project; schema comes from Hibernate plus the hand-run `schema.sql`
(which does not currently mention `feed_plans` at all).

`ddl-auto=update` **adds** tables and columns. It **never drops or alters** them.

`FeedPlan.herdId` is currently mapped `@Column(name = "herd_id", nullable = false)`.

**If you delete that field from the entity, the database column stays `NOT NULL` with no
default, and every subsequent plan INSERT fails at runtime.** Hibernate will not fix this
for you and the failure appears only when someone saves a plan.

**Therefore:** keep `herd_id` on the entity through Phase 2, and relax the column with the
hand-run SQL in §5 *before* the code stops populating it. Drop the column only in Phase 3,
once nothing reads it.

---

## 3. Target data model

```
feed_plans              (id, plan_name, plan_type, total_estimated_cost,
                         created_at, updated_at, herd_id NULLABLE  -- deprecated, dropped in Phase 3)

feed_plan_items         (id, feed_plan_id, feed_id, quantity_kg)          -- unchanged

feed_plan_assignments   (id, feed_plan_id, herd_id, assigned_at)          -- NEW
                         UNIQUE (feed_plan_id, herd_id)
```

Notes:

- `total_estimated_cost` stays on `feed_plans`. Quantities are absolute, so the cost is
  identical for every assigned animal — it is a property of the recipe, not the assignment.
- A plan with **zero** assignments is legal and means "template, not yet applied". This
  avoids conflating *unassign* with *delete*.
- The unique constraint makes assignment idempotent and blocks double-assign.

### New files

```
model/FeedPlanAssignment.java
repository/FeedPlanAssignmentRepository.java
dto/optimizer/UpdatePlanRequestDTO.java
dto/optimizer/AssignPlanRequestDTO.java
dto/optimizer/PlanAdequacyDTO.java
```

### Modified files

```
model/FeedPlan.java                      herd_id -> nullable, mark @Deprecated
dto/optimizer/SavePlanRequestDTO.java    add animalIds; keep animalId as legacy alias
dto/optimizer/PlanSummaryDTO.java        add assignmentCount
dto/optimizer/PlanDetailDTO.java         add assignments[]; deprecate animalId
service/optimizer/CustomPlanService.java rework + new operations
controller/FeedPlanController.java       add PUT, DELETE, assignments, adequacy
```

---

## 4. API

Errors reuse the existing exceptions, which `GlobalExceptionHandler` already maps:
`PlanNotFoundException`, `AnimalNotFoundException`, `FeedNotFoundException` → 404;
bean-validation failures → 400.

### 4.1 `POST /api/feed-plans` — create (backward compatible)

```jsonc
{
  "planName": "Monsoon High-Yield",
  "feedEntries": [{ "feedId": 12, "quantityKg": 3.0 }],
  "animalIds": [4, 7, 9]        // new
  // "animalId": 4              // legacy single form, still accepted
}
```

`animalId` and `animalIds` are both optional; if both are present, union them. If neither
is present the plan is created unassigned. **This keeps the current frontend working
unchanged**, so the backend can ship before the UI.

Validation: `planName` not blank, `feedEntries` not empty, every id resolvable.

Returns `PlanSummaryDTO` + `assignmentCount`.

### 4.2 `GET /api/feed-plans?animalId=X` — unchanged contract

Now resolved through `feed_plan_assignments` instead of `feed_plans.herd_id`. Response
shape gains `assignmentCount`; nothing is removed. Existing callers keep working.

Add `GET /api/feed-plans` (no param) returning all plans, for a future "manage plans"
screen.

### 4.3 `PUT /api/feed-plans/{planId}` — **new**

```jsonc
{ "planName": "Monsoon High-Yield v2",
  "feedEntries": [{ "feedId": 12, "quantityKg": 3.5 }] }
```

Replaces name and feed lines. Because the recipe is shared, this updates every assigned
animal by definition — that is the whole feature.

Implementation: `@Transactional`; `feedPlanItemRepository.deleteByFeedPlanId(planId)` then
insert the new lines; recompute `total_estimated_cost` with the existing logic from
`savePlan`. Extract that cost calculation into a private helper shared by create and update
rather than duplicating it.

### 4.4 `DELETE /api/feed-plans/{planId}` — **new**

Deletes the plan, its items, and its assignments in one transaction. Hard delete is fine
here; these are user-authored records with no downstream references.

### 4.5 `PUT /api/feed-plans/{planId}/assignments` — **new**

```jsonc
{ "animalIds": [4, 7, 9, 11] }
```

**Replaces** the assigned set rather than adding to it. Chosen deliberately: the UI is a
checkbox list, so replace-the-set maps 1:1 onto what the user sees and is naturally
idempotent. An empty array unassigns everything and leaves the plan as a template.

### 4.6 `POST /api/feed-plans/{planId}/adequacy` — **new, the important one**

```jsonc
{ "animalIds": [4, 7, 9] }   // optional; defaults to the currently assigned set
```

Response:

```jsonc
[
  { "animalId": 4, "animalName": "Radha", "tagNumber": "C-014",
    "resolvedStage": "Mid Lactation",
    "overallStatus": "ADEQUATE",
    "nutrientStatus": {
      "DryMatter":    { "current": 12.0, "required": 12.0, "status": "ADEQUATE" },
      "CrudeProtein": { "current": 1.8,  "required": 1.8,  "status": "ADEQUATE" },
      "TDN":          { "current": 7.0,  "required": 7.0,  "status": "ADEQUATE" },
      "Calcium":      { "current": 39.6, "required": 40.0, "status": "ADEQUATE" }
    }},
  { "animalId": 7, "animalName": "Gowri", "tagNumber": "C-021",
    "resolvedStage": "Early Lactation",
    "overallStatus": "DEFICIENT",
    "nutrientStatus": { "...": "..." } }
]
```

Pure read, no writes. Builds entirely on existing services — resolve each animal's
requirement via `AnimalRequirementResolutionService`, evaluate the plan's feed lines via
`NutrientCalculationService`. No new nutrition logic.

`overallStatus` = DEFICIENT if any nutrient is DEFICIENT, else EXCESS if any is EXCESS,
else ADEQUATE.

This is what lets the assign screen show a green/amber chip beside each animal, so a
mixed-condition group cannot be bulk-assigned an unsuitable ration silently.

---

## 5. Migration SQL — hand-run, in this order

Hibernate creates `feed_plan_assignments` on its own at startup. The backfill and the
`NOT NULL` relaxation must be run by hand. **Take a backup first**; this touches a live
MySQL instance.

**Step 1 — after deploying the code that defines the new entity** (so the table exists),
backfill assignments from the existing per-animal rows:

```sql
INSERT INTO feed_plan_assignments (feed_plan_id, herd_id, assigned_at)
SELECT fp.id, fp.herd_id, NOW()
FROM feed_plans fp
WHERE fp.herd_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM feed_plan_assignments fpa
    WHERE fpa.feed_plan_id = fp.id AND fpa.herd_id = fp.herd_id
  );
```

**Step 2 — verify before going further.** These two counts should match:

```sql
SELECT COUNT(*) AS plans_with_animal FROM feed_plans WHERE herd_id IS NOT NULL;
SELECT COUNT(*) AS assignments       FROM feed_plan_assignments;
```

**Step 3 — relax the column so the code can stop populating it:**

```sql
ALTER TABLE feed_plans MODIFY COLUMN herd_id BIGINT NULL;
```

**Step 4 — Phase 3 only, once nothing reads `herd_id`:**

```sql
ALTER TABLE feed_plans DROP COLUMN herd_id;
```

### Optional — review duplicates created before this change

Groups of identically-named plans are probably the same ration saved to several cows and
are candidates for merging into one plan with several assignments. **Review the output
manually; do not merge automatically** — identical names can also be coincidence.

```sql
SELECT plan_name, COUNT(*) AS copies, GROUP_CONCAT(id ORDER BY id) AS plan_ids
FROM feed_plans
GROUP BY plan_name
HAVING COUNT(*) > 1
ORDER BY copies DESC;
```

---

## 6. Suggested delivery order

Each phase is useful on its own and none is wasted by the next.

**Phase 1 — stop the bleeding (small). ✅ DONE.**
`PUT` and `DELETE` for a single plan. No schema change, no assignments. This alone fixes
the fact that a mis-saved plan is currently permanent, which is today's most immediate
problem. Implemented in `CustomPlanService.updatePlan` / `deletePlan`; the cost
calculation is now shared with `savePlan` via the private `writeItems` helper.
Frontend is not yet wired to either endpoint.

**Phase 2 — shared plans. ✅ CODE DONE, MIGRATION NOT YET RUN.**
Assignments table, `POST` accepting `animalIds`, `PUT /{id}/assignments`,
`GET ?animalId=` rerouted through assignments, `GET` with no param listing all plans.

`herd_id` is still WRITTEN (with the first assigned animal), not merely kept — the column
is `NOT NULL` in the database until §5 step 3 runs, so a plan that did not set it would
fail to insert. Once the migration has run this dual-write becomes redundant and is
removed in Phase 3.

**The migration in §5 has not been run.** Until it is: existing plans do not appear in
`GET ?animalId=` (their assignment rows do not exist yet), and creating a plan with no
animals fails. Both resolve after steps 1–3.

**Phase 3 — adequacy + cleanup. ✅ ADEQUACY DONE. `herd_id` REMOVAL DEFERRED.**
`POST /{planId}/adequacy` (`PlanAdequacyService`) and the frontend assign screen with
per-animal ADEQUATE/DEFICIENT/EXCESS chips are implemented.

`herd_id` has deliberately NOT been dropped. Dropping the field while the database column
is still `NOT NULL` makes every plan INSERT fail at runtime (§2), and the §5 migration has
not been confirmed as run. Removal is a two-step job to do once it has:

1. Confirm `SELECT COUNT(*) FROM feed_plan_assignments;` matches the plan count, and that
   `herd_id` is nullable.
2. Delete `FeedPlan.herdId` and its accessors, drop the `plan.setHerdId(...)` dual-writes
   in `CustomPlanService.savePlan` / `replaceAssignments`, drop the `plan.getHerdId()`
   fallback in `loadPlan`, then run §5 step 4.

Until then the dual-write is harmless and keeps the app deployable either side of the
migration.

---

## 7. Open questions

1. **Duplicate plan names** — allow freely, or reject a duplicate name? Currently allowed.
   Suggest continuing to allow, since a name is not an identifier here.
2. **Merging the existing duplicates** — worth doing once, or leave the old rows alone?
   Depends how much real data exists; the query in §5 will tell you.
3. **Audit fields** — `FeedPlan` has no `created_by` / `updated_by`, unlike `Herd`. Worth
   adding while the entity is being touched anyway, if plans are edited by several people.
