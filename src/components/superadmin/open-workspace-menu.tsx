'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { LogIn, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { openWorkspace } from '@/app/superadmin/actions'
import type { ProfileWorkspace } from '@/app/superadmin/queries'

/**
 * Lets a super-admin drop straight into any of a user's active workspaces.
 * 0 memberships → disabled; 1 → single button; 2+ → a menu to pick the role.
 * `openWorkspace` redirects into the impersonated portal on success.
 */
export function OpenWorkspaceMenu({
  memberships,
  userName,
}: {
  memberships: ProfileWorkspace[]
  userName: string
}) {
  const [isPending, startTransition] = useTransition()

  function open(membershipId: string, label: string) {
    startTransition(async () => {
      const res = await openWorkspace(membershipId)
      // Success redirects into the portal; only failures return here.
      if (res?.error) toast.error(res.error)
      else toast.success(`Opening ${userName}'s ${label} workspace…`)
    })
  }

  if (memberships.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled title="This user has no active workspace">
        No workspace
      </Button>
    )
  }

  if (memberships.length === 1) {
    const m = memberships[0]
    const label = `${m.position_name} · ${m.branch_name}`
    return (
      <Button variant="outline" size="sm" disabled={isPending} onClick={() => open(m.membership_id, label)}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
        Open workspace
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Open workspace
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Choose a workspace
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.membership_id}
            onClick={() => open(m.membership_id, `${m.position_name} · ${m.branch_name}`)}
            className="cursor-pointer"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{m.position_name}</p>
              <p className="truncate text-xs text-muted-foreground">{m.branch_name}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
