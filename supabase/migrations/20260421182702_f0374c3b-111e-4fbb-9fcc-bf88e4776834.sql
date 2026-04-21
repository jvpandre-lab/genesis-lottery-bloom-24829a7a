
-- 1. Sinais de pressão adaptativa
CREATE TABLE public.adaptive_pressure_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  threshold NUMERIC,
  triggered BOOLEAN NOT NULL DEFAULT false,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pressure_signals_gen ON public.adaptive_pressure_signals(generation_id);
CREATE INDEX idx_pressure_signals_type ON public.adaptive_pressure_signals(signal_type);

-- 2. Ajustes adaptativos aplicados
CREATE TABLE public.adaptive_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_adjustments_gen ON public.adaptive_adjustments(generation_id);

-- 3. Histórico de linhagens (dominância, exploração, drift)
CREATE TABLE public.lineage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE,
  lineage TEXT NOT NULL,
  dominance_score NUMERIC NOT NULL DEFAULT 0,
  exploration_rate NUMERIC,
  stability_score NUMERIC,
  drift_magnitude NUMERIC,
  drift_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lineage_history_gen ON public.lineage_history(generation_id);
CREATE INDEX idx_lineage_history_lineage ON public.lineage_history(lineage);

-- 4. Snapshots territoriais
CREATE TABLE public.territory_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID REFERENCES public.generations(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  saturation_level NUMERIC,
  pressure_zones JSONB DEFAULT '[]'::jsonb,
  blind_zones JSONB DEFAULT '[]'::jsonb,
  drift_magnitude NUMERIC,
  drift_direction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_territory_snapshots_gen ON public.territory_snapshots(generation_id);

-- 5. Transições de cenário
CREATE TABLE public.scenario_transitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_scenario TEXT,
  to_scenario TEXT NOT NULL,
  reason TEXT NOT NULL,
  triggered_by JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenario_transitions_created ON public.scenario_transitions(created_at DESC);

-- RLS — acesso público (consistente com as tabelas existentes)
ALTER TABLE public.adaptive_pressure_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adaptive_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenario_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public all pressure signals" ON public.adaptive_pressure_signals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all adjustments" ON public.adaptive_adjustments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all lineage history" ON public.lineage_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all territory snapshots" ON public.territory_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public all scenario transitions" ON public.scenario_transitions FOR ALL USING (true) WITH CHECK (true);
