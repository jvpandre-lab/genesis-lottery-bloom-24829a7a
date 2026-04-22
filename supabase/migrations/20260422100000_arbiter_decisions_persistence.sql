-- Create table for arbiter decisions persistence
CREATE TABLE arbiter_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision TEXT NOT NULL, -- 'chosen' or 'rejected'
  chosen_brain TEXT,
  rejected_brain TEXT,
  scores JSONB, -- DecisionCandidateSnapshot for chosen and rejected
  scenario TEXT,
  batch TEXT,
  mutation_rate FLOAT,
  balance_a FLOAT,
  result JSONB, -- optional result data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance on queries by timestamp
CREATE INDEX idx_arbiter_decisions_created_at ON arbiter_decisions(created_at);

-- Index for scenario filtering
CREATE INDEX idx_arbiter_decisions_scenario ON arbiter_decisions(scenario);