-- Create table for arbiter decisions persistence
CREATE TABLE arbiter_decisions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  batch_name TEXT,
  scenario TEXT,
  slot INTEGER,
  mutation_rate FLOAT,
  balance_a FLOAT,
  chosen_brain TEXT,
  rejected_brain TEXT,
  chosen_lineage TEXT,
  rejected_lineage TEXT,
  chosen_score FLOAT,
  rejected_score FLOAT,
  marginal_diversity FLOAT,
  coverage FLOAT,
  cluster FLOAT,
  memory_bias FLOAT,
  decision TEXT NOT NULL,
  outcome_good BOOLEAN,
  scores JSONB,
  metadata JSONB,
  source TEXT
);

-- Index for performance on queries by timestamp
CREATE INDEX idx_arbiter_decisions_created_at ON arbiter_decisions(created_at);

-- Index for scenario filtering
CREATE INDEX idx_arbiter_decisions_scenario ON arbiter_decisions(scenario);

CREATE INDEX idx_arbiter_decisions_batch_name ON arbiter_decisions(batch_name);
CREATE INDEX idx_arbiter_decisions_chosen_brain ON arbiter_decisions(chosen_brain);