import Link from 'next/link'
import { Building2, GitBranch } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getOrganizationTree, type OrgNode } from '@/app/superadmin/queries'
import { CreateOrgDialog } from './create-org-dialog'

// ── Organization Tree Row (recursive) ────────────────────────

function OrgTreeRow({ node, depth }: { node: OrgNode; depth: number }) {
  return (
    <div>
      <Link
        href={`/superadmin/organizations/${node.id}`}
        className="flex items-center justify-between gap-3 rounded-lg py-2.5 pr-3 text-sm transition-colors hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
      >
        <span className="flex min-w-0 items-center gap-2">
          {depth === 0 ? (
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          )}
          <span className={depth === 0 ? 'font-semibold' : 'font-medium'}>{node.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">/{node.slug}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {node.memberCount} member{node.memberCount === 1 ? '' : 's'}
        </span>
      </Link>
      {node.children.map((child) => (
        <OrgTreeRow key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default async function OrganizationsPage() {
  const orgTree = await getOrganizationTree()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse and manage every organization, branch, and sub-branch.
          </p>
        </div>
        <CreateOrgDialog />
      </div>

      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-base">Organization Hierarchy</CardTitle>
          <CardDescription>Click a row to view details, tabs, and members.</CardDescription>
        </CardHeader>
        <CardContent>
          {orgTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-sm text-muted-foreground">
                No organizations yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {orgTree.map((root) => (
                <OrgTreeRow key={root.id} node={root} depth={0} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
