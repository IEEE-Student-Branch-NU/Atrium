'use client'

import { useState, useTransition } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendNotification } from '@/app/superadmin/actions'

type Target = 'broadcast' | 'user' | 'branch'

interface Props {
  branches: { id: string; name: string }[]
  recipients: { id: string; full_name: string | null; email: string }[]
}

export function SendNotificationDialog({ branches, recipients }: Props) {
  const [open, setOpen] = useState(false)
  const [target, setTarget] = useState<Target>('broadcast')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(formData: FormData) {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await sendNotification(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setOpen(false), 1500)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        setError(null)
        setSuccess(false)
        if (!v) setTarget('broadcast')
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" className="gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
            <Send className="h-4 w-4" />
            Send notification
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a notification</DialogTitle>
          <DialogDescription>
            Notify everyone, a single member, or a branch&apos;s Chairs.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {/* Target */}
          <div className="space-y-2">
            <Label htmlFor="target">Send to</Label>
            <select
              id="target"
              name="target"
              value={target}
              onChange={(e) => setTarget(e.target.value as Target)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="broadcast">Everyone (broadcast)</option>
              <option value="user">A specific member</option>
              <option value="branch">A branch&apos;s Chairs</option>
            </select>
          </div>

          {target === 'user' && (
            <div className="space-y-2">
              <Label htmlFor="profile_id">Member</Label>
              <select
                id="profile_id"
                name="profile_id"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Select a member…</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.full_name ?? r.email} ({r.email})
                  </option>
                ))}
              </select>
            </div>
          )}

          {target === 'branch' && (
            <div className="space-y-2">
              <Label htmlFor="branch_id">Branch</Label>
              <select
                id="branch_id"
                name="branch_id"
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Select a branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" placeholder="e.g. Scheduled maintenance" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Style</Label>
            <select
              id="type"
              name="type"
              defaultValue="info"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="info">Info (Blue)</option>
              <option value="success">Success (Green)</option>
              <option value="warning">Warning (Orange)</option>
              <option value="error">Error (Red)</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" rows={4} placeholder="Write your message…" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link">Link (optional)</Label>
            <Input id="link" name="link" placeholder="e.g. /events" />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Notification sent.</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Sending…' : 'Send'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
