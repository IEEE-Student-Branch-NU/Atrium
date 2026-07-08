export const LEADERSHIP_POSITIONS = [
  'Chair', 'Vice Chair', 'General Secretary', 'Technical Head', 'Creative Head', 'MDO',
] as const

export function isLeadershipPosition(name: string | null | undefined): boolean {
  if (!name) return false
  const n = name.trim().toLowerCase()
  return LEADERSHIP_POSITIONS.some((p) => p.toLowerCase() === n)
}

export function classifyMembers<T extends { position_name: string | null }>(
  members: T[]
): { exec: T[]; associates: T[] } {
  const exec: T[] = []
  const associates: T[] = []
  for (const m of members) {
    if (isLeadershipPosition(m.position_name)) exec.push(m)
    else associates.push(m)
  }
  return { exec, associates }
}
