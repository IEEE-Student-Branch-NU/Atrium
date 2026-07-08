export type EffectiveActor = {
  realProfileId: string | null
  realEmail: string | null
  isSuperAdmin: boolean
  isImpersonating: boolean
  actingProfileId: string | null
  actingMembershipId: string | null
}

export type ResolveInput = {
  realProfileId: string | null
  realEmail: string | null
  isSuperAdmin: boolean
  impersonatedMembership: { id: string; profile_id: string } | null
}

/** Pure resolution — unit-testable. Only super admins may impersonate. */
export function resolveEffectiveActor(input: ResolveInput): EffectiveActor {
  const canImpersonate = input.isSuperAdmin && input.impersonatedMembership != null
  return {
    realProfileId: input.realProfileId,
    realEmail: input.realEmail,
    isSuperAdmin: input.isSuperAdmin,
    isImpersonating: canImpersonate,
    actingProfileId: canImpersonate ? input.impersonatedMembership!.profile_id : input.realProfileId,
    actingMembershipId: canImpersonate ? input.impersonatedMembership!.id : null,
  }
}
