// ============================================================
// Pure helpers for deciding who may see branch-scoped notifications.
// The authoritative enforcement lives in the DB RLS policy (migration
// 00011); these mirror it for server-rendered gating and are unit-tested.
// ============================================================

/** The single position name that grants branch-activity visibility. */
export const CHAIR_POSITION_NAME = 'Chair'

/** True when a position name is the branch Chair (case-sensitive, matches RLS). */
export function isChairPosition(positionName: string | null | undefined): boolean {
  return positionName === CHAIR_POSITION_NAME
}

interface ActiveMembership {
  branch_id: string
  position_name: string | null
  is_active?: boolean
}

/** Branch ids where the given memberships make the user a Chair. */
export function chairBranchIds(memberships: ActiveMembership[]): string[] {
  return memberships
    .filter((m) => (m.is_active ?? true) && isChairPosition(m.position_name))
    .map((m) => m.branch_id)
}
