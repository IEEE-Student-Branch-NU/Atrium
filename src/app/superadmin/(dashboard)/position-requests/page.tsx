import { getPendingPositionRequests, getCancelledPositionRequests } from '@/lib/queries'
import { getRecentDecidedPositionRequests } from '@/app/superadmin/queries'
import { SuperAdminPositionRequestsClient } from './client'

const HISTORY_LIMIT = 25

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function statusVariant(status: string): 'default' | 'destructive' {
  return status === 'approved' ? 'default' : 'destructive'
}

// ── Page ─────────────────────────────────────────────────────
// Reuses the existing all-branch pending queue (`getPendingPositionRequests`)
// and the existing approve/reject server actions — see ./request-controls.tsx.
// Only the decided-request history query below is new.

export default async function SuperAdminPositionRequestsPage() {
  const [pending, history, cancelled] = await Promise.all([
    getPendingPositionRequests(),
    getRecentDecidedPositionRequests(HISTORY_LIMIT),
    getCancelledPositionRequests()
  ])

  return (
    <SuperAdminPositionRequestsClient 
      pending={pending} 
      history={history} 
      cancelled={cancelled} 
    />
  )
}
