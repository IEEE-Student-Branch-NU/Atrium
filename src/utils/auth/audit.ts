import 'server-only'
import { createAdminClient } from '@/utils/supabase/server'

export type AdminAction = {
  actorProfileId: string
  action: string
  entityType: 'organization' | 'branch' | 'position' | 'user' | 'membership' | 'permission' | 'workspace'
  entityId?: string | null
  branchId?: string | null
  summary: string
  details?: Record<string, unknown> | null
}

/** Best-effort audit write. Never throws into the caller — a failed audit must not break the action. */
export async function logAdminAction(a: AdminAction): Promise<void> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('audit_log').insert({
      actor_profile_id: a.actorProfileId,
      action: a.action,
      entity_type: a.entityType,
      entity_id: a.entityId ?? null,
      branch_id: a.branchId ?? null,
      summary: a.summary,
      details: a.details ?? null,
    })
    if (error) console.error('logAdminAction failed', error)
  } catch (e) {
    console.error('logAdminAction failed', e)
  }
}
