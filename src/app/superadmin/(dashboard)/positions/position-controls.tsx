'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { createPosition, updatePosition, deletePosition, setPositionPermissions } from '@/app/superadmin/actions'
import type { BranchOption } from '@/lib/queries'
import type { PermissionRow } from '@/app/superadmin/queries'

type ActionResult = { success?: boolean; error?: string }

const initialState: ActionResult = {}

type PositionSummary = { id: string; name: string; permissionIds: string[] }

// ── Create Position ──────────────────────────────────────────

export function CreatePositionForm({ branches }: { branches: BranchOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [branchId, setBranchId] = useState('')

  // Side effects (toast, close, refresh) run inline as part of the transition
  // triggered by form submission — matches ../organizations/create-org-dialog.tsx.
  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await createPosition(formData)
      if (result?.success) {
        toast.success('Position created')
        setOpen(false)
        setBranchId('')
        router.refresh()
      } else if (result?.error) {
        toast.error(result.error)
      }
      return result ?? {}
    },
    initialState
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setBranchId('')
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        Create Position
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Create Position</DialogTitle>
            <DialogDescription>Add a new position to a branch.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-position-branch">
                Branch <span className="text-destructive">*</span>
              </Label>
              <Select
                name="branch_id"
                value={branchId || undefined}
                onValueChange={(value) => setBranchId(String(value))}
              >
                <SelectTrigger id="create-position-branch" className="w-full">
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
              <Label htmlFor="create-position-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input id="create-position-name" name="name" placeholder="e.g. Technical Head" required />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !branchId}>
              {pending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Rename Position ──────────────────────────────────────────

function RenamePositionDialog({ position }: { position: PositionSummary }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await updatePosition(formData)
      if (result?.success) {
        toast.success('Position renamed')
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
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Pencil className="h-3.5 w-3.5" />
        <span className="sr-only">Rename position</span>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Rename Position</DialogTitle>
            <DialogDescription>Update the display name for this position.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={position.id} />

          <div className="space-y-2 py-4">
            <Label htmlFor={`rename-${position.id}`}>
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id={`rename-${position.id}`} name="name" defaultValue={position.name} required />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Delete Position ──────────────────────────────────────────
// Not wired through useActionState/<form action> — the action is invoked
// directly so we can gate it behind a native confirm() first (no dialog
// component in this UI kit renders a blocking confirm affordance).

function DeletePositionButton({ position }: { position: PositionSummary }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete the position "${position.name}"? This cannot be undone.`)) return
    setPending(true)
    const formData = new FormData()
    formData.set('id', position.id)
    const result = await deletePosition(formData)
    setPending(false)
    if (result?.success) {
      toast.success('Position deleted')
      router.refresh()
    } else if (result?.error) {
      toast.error(result.error)
    }
  }

  return (
    <Button variant="ghost" size="icon-sm" onClick={handleDelete} disabled={pending}>
      <Trash2 className="h-3.5 w-3.5 text-destructive" />
      <span className="sr-only">Delete position</span>
    </Button>
  )
}

// ── Permissions Editor ───────────────────────────────────────

function PermissionsDialog({
  position,
  allPermissions,
}: {
  position: PositionSummary
  allPermissions: PermissionRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await setPositionPermissions(formData)
      if (result?.success) {
        toast.success('Permissions updated')
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
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ShieldCheck className="h-3.5 w-3.5" />
        Edit Permissions
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Permissions — {position.name}</DialogTitle>
            <DialogDescription>
              Choose which permissions this position grants to anyone who holds it.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="position_id" value={position.id} />

          <div className="max-h-72 space-y-1 overflow-y-auto py-4">
            {allPermissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions defined yet.</p>
            ) : (
              allPermissions.map((perm) => (
                <Label
                  key={perm.id}
                  htmlFor={`perm-${position.id}-${perm.id}`}
                  className="flex items-start gap-2.5 rounded-lg border border-transparent px-2 py-1.5 font-normal hover:bg-muted/50"
                >
                  <Checkbox
                    id={`perm-${position.id}-${perm.id}`}
                    name="permission_ids"
                    value={perm.id}
                    defaultChecked={position.permissionIds.includes(perm.id)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm">{perm.name}</span>
                    {perm.description && (
                      <span className="text-xs text-muted-foreground">{perm.description}</span>
                    )}
                  </span>
                </Label>
              ))
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : 'Save Permissions'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Position Card ────────────────────────────────────────────

export function PositionCard({
  position,
  allPermissions,
}: {
  position: PositionSummary
  allPermissions: PermissionRow[]
}) {
  const grantedPermissions = allPermissions.filter((p) => position.permissionIds.includes(p.id))

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{position.name}</span>
        <div className="flex items-center gap-1">
          <PermissionsDialog position={position} allPermissions={allPermissions} />
          <RenamePositionDialog position={position} />
          <DeletePositionButton position={position} />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {grantedPermissions.length === 0 ? (
          <span className="text-xs text-muted-foreground">No permissions granted.</span>
        ) : (
          grantedPermissions.map((p) => (
            <Badge key={p.id} variant="secondary">
              {p.name}
            </Badge>
          ))
        )}
      </div>
    </div>
  )
}
