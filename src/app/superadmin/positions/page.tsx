import { BadgeCheck } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getAllBranches } from '@/lib/queries'
import { listPositionsGrouped, getAllPermissions } from '../queries'
import { CreatePositionForm, PositionCard } from './position-controls'

// ── Page ─────────────────────────────────────────────────────

export default async function PositionsPage() {
  const [groups, branches, permissions] = await Promise.all([
    listPositionsGrouped(),
    getAllBranches(),
    getAllPermissions(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every position across every branch, with the permissions it grants.
          </p>
        </div>
        <CreatePositionForm branches={branches} />
      </div>

      {groups.length === 0 ? (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BadgeCheck className="h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              No positions yet. Create one to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <Card key={group.branchId} className="border-border/50 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-base">{group.branchName || 'Unassigned branch'}</CardTitle>
                <CardDescription>
                  {group.positions.length} position{group.positions.length === 1 ? '' : 's'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border/50 rounded-md border">
                  {group.positions.map((position) => (
                    <PositionCard
                      key={position.id}
                      position={position}
                      allPermissions={permissions}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
