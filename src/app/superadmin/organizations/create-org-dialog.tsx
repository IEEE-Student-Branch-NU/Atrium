'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createOrganization, createSubBranch, updateBranch } from '../actions'

type ActionResult = { success?: boolean; error?: string }

const initialState: ActionResult = {}

interface CreateOrgDialogProps {
  /** Present when creating a sub-branch under this parent. */
  parentId?: string
  /** Parent org name, used only for dialog copy. */
  parentName?: string
  /** Present when editing an existing branch. */
  branch?: { id: string; name: string; slug: string; description: string | null }
  triggerLabel?: string
  triggerVariant?: React.ComponentProps<typeof Button>['variant']
  triggerSize?: React.ComponentProps<typeof Button>['size']
}

export function CreateOrgDialog({
  parentId,
  parentName,
  branch,
  triggerLabel,
  triggerVariant = 'default',
  triggerSize = 'default',
}: CreateOrgDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const isEdit = Boolean(branch)
  const isSubBranch = !isEdit && Boolean(parentId)
  const action = isEdit ? updateBranch : isSubBranch ? createSubBranch : createOrganization

  // Side effects (toast, close, refresh) run inline as part of the transition
  // triggered by form submission — not in a useEffect — so a successful
  // mutation reacts immediately without an extra render round-trip.
  const [, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prevState, formData) => {
      const result = await action(formData)
      if (result?.success) {
        toast.success(
          isEdit ? 'Branch updated' : isSubBranch ? 'Sub-branch created' : 'Organization created'
        )
        setOpen(false)
        router.refresh()
      } else if (result?.error) {
        toast.error(result.error)
      }
      return result ?? {}
    },
    initialState
  )

  const title = isEdit ? 'Edit Branch' : isSubBranch ? 'Create Sub-Branch' : 'Create Organization'
  const description = isEdit
    ? 'Update the name, slug, or description of this branch.'
    : isSubBranch
      ? `Add a new branch under ${parentName ?? 'this organization'}.`
      : 'Add a new top-level organization to the hierarchy.'

  const defaultTriggerLabel = isEdit ? 'Edit' : isSubBranch ? 'Create Sub-Branch' : 'Create Organization'
  const TriggerIcon = isEdit ? Pencil : Plus

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} size={triggerSize} />}>
        <TriggerIcon className="h-4 w-4" />
        {triggerLabel ?? defaultTriggerLabel}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {isSubBranch && <input type="hidden" name="parent_id" value={parentId} />}
          {isEdit && branch && <input type="hidden" name="id" value={branch.id} />}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. IEEE Nirma University Student Branch"
                defaultValue={branch?.name}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                name="slug"
                placeholder="e.g. ieee-nirma"
                defaultValue={branch?.slug}
                required
              />
              <p className="text-xs text-muted-foreground">
                Used in URLs. Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Optional description"
                defaultValue={branch?.description ?? ''}
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
