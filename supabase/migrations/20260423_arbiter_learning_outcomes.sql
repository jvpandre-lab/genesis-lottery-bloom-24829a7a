-- Add outcome_hits and outcome_quality columns to arbiter_decisions
-- These support the real outcome-based learning system in arbiterMemory
-- outcome_hits: number of actual lottery hits for the draw linked to this decision
-- outcome_quality: categorical classification based on hits ('good' / 'neutral' / 'bad')

ALTER TABLE arbiter_decisions
  ADD COLUMN IF NOT EXISTS outcome_hits INTEGER,
  ADD COLUMN IF NOT EXISTS outcome_quality TEXT CHECK (outcome_quality IN ('good', 'neutral', 'bad'));

-- Index for efficient filtering on decisions that have been evaluated
CREATE INDEX IF NOT EXISTS idx_arbiter_decisions_outcome_quality
  ON arbiter_decisions(outcome_quality)
  WHERE outcome_quality IS NOT NULL;
