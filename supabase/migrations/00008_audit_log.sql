
-- ============================================================
-- Migration 00008: Unified audit_log for super-admin / structural actions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_profile_id  UUID NOT NULL REFERENCES profiles(id),
  action            TEXT NOT NULL,
  entity_type       TEXT NOT NULL,
  entity_id         UUID,
  branch_id         UUID REFERENCES branches(id),
  summary           TEXT NOT NULL,
  details           JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor   ON public.audit_log(actor_profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity  ON public.audit_log(entity_type, entity_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY; -- service-role only; no public policies
