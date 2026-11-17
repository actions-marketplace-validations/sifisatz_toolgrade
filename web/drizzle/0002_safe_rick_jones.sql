ALTER TABLE "runs" ADD COLUMN "billable_units" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Backfill existing rows: one billable unit per (task, trial) where every arm that ran for it
-- completed cleanly (no trial in the group has an "error"). Matches lib/usage.ts's billableUnits().
UPDATE "runs" SET "billable_units" = COALESCE((
  SELECT count(*)
  FROM (
    SELECT bool_and((t->>'error') IS NULL) AS ok
    FROM jsonb_array_elements(report->'trials') AS t
    GROUP BY t->>'taskId', t->>'trial'
  ) groups
  WHERE groups.ok
), 0);