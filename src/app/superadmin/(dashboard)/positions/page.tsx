import { BadgeCheck } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAllBranches } from '@/lib/queries'
import { listPositionsGrouped, getAllPermissions } from '@/app/superadmin/queries'
import { CreatePositionForm, PositionRow } from './position-controls'

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
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[250px]">Position Name</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead className="w-[200px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.positions.map((position) => (
                      <PositionRow
                        key={position.id}
                        position={position}
                        allPermissions={permissions}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
