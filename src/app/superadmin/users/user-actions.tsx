'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assignPosition, grantPermission } from '../actions'
import type { BranchOption, PositionOption } from '@/lib/queries'
import type { PermissionRow } from '../queries'

type ActionResult = { success?: boolean; error?: string }

const initialState: ActionResult = {}

// ── Assign Position ──────────────────────────────────────────

interface AssignPositionDialogProps {
  profileId: string
  branches: BranchOption[]
  positionsByBranch: Record<string, PositionOption[]>
}

export function AssignPositionDialog({
  profileId,
  branches,
  positionsByBranch,
}: AssignPositionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [branchId, setBranchId] = useState('')
  const [positionId, setPositionId] = useState('')

  // Side effects (toast, close, refresh) run inline as part of the transition
  // triggered by form submission — matches the pattern established in
  // ../organizations/create-org-dialog.tsx.
  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await assignPosition(formData)
      if (result?.success) {
        toast.success('Position assigned')
        setOpen(false)
        setBranchId('')
        setPositionId('')
        router.refresh()
      } else if (result?.error) {
        toast.error(result.error)
      }
      return result ?? {}
    },
    initialState
  )

  const positions = branchId ? (positionsByBranch[branchId] ?? []) : []

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setBranchId('')
          setPositionId('')
        }
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="h-4 w-4" />
        Assign Position
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Assign Position</DialogTitle>
            <DialogDescription>Grant this user a position in a branch.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="profile_id" value={profileId} />

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assign-branch">
                Branch <span className="text-destructive">*</span>
              </Label>
              <Select
                name="branch_id"
                value={branchId || undefined}
                onValueChange={(value) => {
                  setBranchId(String(value))
                  setPositionId('')
                }}
              >
                <SelectTrigger id="assign-branch" className="w-full">
                  <SelectValue placeholder="Select a branch">
                    {branchId ? branches.find((b) => b.id === branchId)?.name : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assign-position">
                Position <span className="text-destructive">*</span>
              </Label>
              {/* Remounts (and resets any prior selection) whenever the
                  branch changes, since the option list itself changes. */}
              <Select 
                key={branchId} 
                name="position_id" 
                disabled={!branchId}
                value={positionId || undefined}
                onValueChange={(val) => setPositionId(String(val))}
              >
                <SelectTrigger id="assign-position" className="w-full">
                  <SelectValue placeholder={branchId ? 'Select a position' : 'Select a branch first'}>
                    {positionId ? positions.find((p) => p.id === positionId)?.name : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assign-reason">Reason</Label>
              <Input id="assign-reason" name="reason" placeholder="Optional note for the audit log" />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !branchId}>
              {pending ? 'Assigning...' : 'Assign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Grant Permission ─────────────────────────────────────────

interface GrantPermissionDialogProps {
  profileId: string
  branches: BranchOption[]
  permissions: PermissionRow[]
}

export function GrantPermissionDialog({ profileId, branches, permissions }: GrantPermissionDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await grantPermission(formData)
      if (result?.success) {
        toast.success('Permission granted')
        setOpen(false)
        router.refresh()
      } else if (result?.error) {
        toast.error(result.error)
      }
      return result ?? {}
    },
    initialState
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="h-4 w-4" />
        Grant Permission
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Grant Permission</DialogTitle>
            <DialogDescription>
              Grant a direct permission to this user in a branch, independent of their position.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="profile_id" value={profileId} />

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="grant-branch">
                Branch <span className="text-destructive">*</span>
              </Label>
              <Select name="branch_id">
                <SelectTrigger id="grant-branch" className="w-full">
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="grant-permission">
                Permission <span className="text-destructive">*</span>
              </Label>
              <Select name="permission_id">
                <SelectTrigger id="grant-permission" className="w-full">
                  <SelectValue placeholder="Select a permission" />
                </SelectTrigger>
                <SelectContent>
                  {permissions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Granting...' : 'Grant'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
